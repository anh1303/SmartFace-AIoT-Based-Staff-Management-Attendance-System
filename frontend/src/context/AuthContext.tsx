import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserSession, Role, Employee } from '../types';
import { loginApi, logoutApi, meApi, DEFAULT_USERS, faceLoginApi, FACE_LOGIN_TIMEOUTS, withBoundedSignal } from '@/features/auth';
import { useToast } from './ToastContext';
import { useOptionalNotifications } from '../features/notifications';
import { logger } from '../utils/logger';
import { ApiError } from '../api/client';

const authLogger = logger.child('AuthContext');

const COMPLETE_INDETERMINATE_MESSAGE = 'Chưa xác định được kết quả đăng nhập. Vui lòng kiểm tra kết nối hoặc tải lại trang.';
const BUSY_LOGOUT_MESSAGE = 'Đang đăng xuất. Vui lòng chờ rồi thử lại.';
const BUSY_COMPLETE_MESSAGE = 'Đang hoàn tất đăng nhập khuôn mặt. Vui lòng chờ rồi thử lại.';

let globalSessionId = 1;
let globalCurrentUsername = '';

export function getActiveSessionId(): number {
  return globalSessionId;
}

export function getActiveUsername(): string {
  return globalCurrentUsername;
}

function bumpGlobalSession(user: UserSession | null): number {
  globalSessionId++;
  globalCurrentUsername = user?.username || '';
  return globalSessionId;
}

type FaceCompleteResult = { success: boolean; message?: string; role?: Role };

interface AuthContextType {
  currentUser: UserSession | null;
  role: Role;
  sessionId: number;
  isInitializing: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  login: (identifier: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string; role?: Role }>;
  completeFaceLogin: (attemptId: string) => Promise<FaceCompleteResult>;
  logout: () => Promise<void>;
  switchRole: (role: Role, employeesFallback?: Employee[]) => void;
  setCurrentUserSession: (session: UserSession | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const notifications = useOptionalNotifications();

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      // Dọn sạch localStorage tồn đọng để không tự động đăng nhập khi mở lại
      localStorage.removeItem('userSession');
      localStorage.removeItem('token');
      const saved = sessionStorage.getItem('userSession');
      const parsed = saved ? JSON.parse(saved) : null;
      globalCurrentUsername = parsed?.username || '';
      return parsed;
    } catch {
      return null;
    }
  });

  const [sessionId, setSessionId] = useState<number>(() => globalSessionId);

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);
  const activeLogoutPromiseRef = useRef<Promise<void> | null>(null);
  const authEpochRef = useRef<number>(0);
  const activeCompleteRef = useRef<{
    attemptId: string;
    promise: Promise<FaceCompleteResult>;
    controller: AbortController;
  } | null>(null);

  const role: Role = currentUser?.role || 'employee';

  useEffect(() => {
    let isMounted = true;

    // Validate session on mount via HttpOnly cookie (Do not blindly trust storage)
    meApi()
      .then(session => {
        if (!isMounted) return;
        if (session) {
          bumpGlobalSession(session);
          setCurrentUser(session);
          setSessionId(globalSessionId);
          sessionStorage.setItem('userSession', JSON.stringify(session));
        } else {
          // If cookie verification fails or expires, clear stale session
          bumpGlobalSession(null);
          setCurrentUser(null);
          setSessionId(globalSessionId);
          sessionStorage.removeItem('userSession');
          localStorage.removeItem('userSession');
        }
      })
      .catch(error => {
        authLogger.warn('Session verification failed on mount:', error);
        if (!isMounted) return;
        bumpGlobalSession(null);
        setCurrentUser(null);
        setSessionId(globalSessionId);
        sessionStorage.removeItem('userSession');
        localStorage.removeItem('userSession');
      })
      .finally(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
      activeCompleteRef.current?.controller.abort();
      activeCompleteRef.current = null;
    };
  }, []);

  const acceptSession = useCallback((session: UserSession, rememberMe: boolean) => {
    queryClient.clear();
    notifications?.clearAll(true);
    bumpGlobalSession(session);
    setCurrentUser(session);
    setSessionId(globalSessionId);
    sessionStorage.removeItem('userSession');
    localStorage.removeItem('userSession');
    (rememberMe ? localStorage : sessionStorage).setItem('userSession', JSON.stringify(session));
  }, [queryClient, notifications]);

  /**
   * Explicit face-login completion (the only request that receives an auth cookie).
   * - One-way ordering with logout: if logout is active, returns cancelled immediately (never awaits logout).
   * - Double complete for the same attempt reuses the active promise; different attempt returns conflict.
   * - Total budget 10,000 ms (each POST complete <= 4,000 ms, status <= 2,000 ms, max 4 polls >= 250 ms apart).
   * - Never uses /me of an existing session as proof of completion.
   */
  const completeFaceLogin = useCallback(async (attemptId: string): Promise<FaceCompleteResult> => {
    if (isLoggingOutRef.current || activeLogoutPromiseRef.current) {
      return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
    }
    const existing = activeCompleteRef.current;
    if (existing) {
      if (existing.attemptId === attemptId) {
        return existing.promise;
      }
      return { success: false, message: BUSY_COMPLETE_MESSAGE };
    }

    const myEpoch = authEpochRef.current;
    const startingSession = globalSessionId;
    const controller = new AbortController();
    let timedOut = false;
    const budgetTimer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException('Complete budget exceeded.', 'TimeoutError'));
    }, FACE_LOGIN_TIMEOUTS.COMPLETE_BUDGET_MS);

    const budgetDeadlineMono = performance.now() + FACE_LOGIN_TIMEOUTS.COMPLETE_BUDGET_MS;
    const remainingBudget = () => Math.max(0, budgetDeadlineMono - performance.now());
    const isCancelled = () =>
      isLoggingOutRef.current ||
      Boolean(activeLogoutPromiseRef.current) ||
      authEpochRef.current !== myEpoch ||
      startingSession !== globalSessionId;

    const accept = (session: UserSession, targetRole?: Role): FaceCompleteResult => {
      if (isCancelled() || controller.signal.aborted) {
        return {
          success: false,
          message: timedOut ? COMPLETE_INDETERMINATE_MESSAGE : 'Lượt đăng nhập đã được hủy.',
        };
      }
      acceptSession(session, false);
      return { success: true, role: targetRole };
    };

    const runComplete = (
      async (): Promise<FaceCompleteResult> => {
        try {
          const postTimeout = Math.min(FACE_LOGIN_TIMEOUTS.COMPLETE_POST_MS, Math.max(1, remainingBudget()));
          const { session, targetRole } = await withBoundedSignal(postTimeout, controller.signal, (sig) =>
            faceLoginApi.complete(attemptId, sig),
          );
          return accept(session, targetRole);
        } catch (failure) {
          if (isCancelled()) {
            return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
          }
          if (timedOut || remainingBudget() <= 0) {
            return { success: false, message: COMPLETE_INDETERMINATE_MESSAGE };
          }
          if (failure instanceof ApiError) {
            if ([401, 403, 404, 410].includes(failure.statusCode)) {
              return { success: false, message: failure.message };
            }
            if (failure.statusCode !== 409 && failure.statusCode < 500) {
              return { success: false, message: failure.message };
            }
          }

          // Bounded recovery: up to 4 status polls (>= 250 ms apart) + at most 1 complete retry within the shared 10s budget
          try {
            for (let poll = 0; poll < 4; poll++) {
              if (poll > 0) {
                if (remainingBudget() < 250) break;
                await abortableDelay(250, controller.signal);
              }
              if (isCancelled()) return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
              const remStatus = remainingBudget();
              if (remStatus <= 0) break;
              const statusTimeout = Math.min(FACE_LOGIN_TIMEOUTS.STATUS_MS, Math.max(1, remStatus));
              const status = await withBoundedSignal(statusTimeout, controller.signal, (sig) =>
                faceLoginApi.status(attemptId, sig),
              );
              if (isCancelled()) return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
              if (status.state === 'completed' || status.state === 'verified') {
                const remComplete = remainingBudget();
                if (remComplete <= 0) break;
                const retryTimeout = Math.min(FACE_LOGIN_TIMEOUTS.COMPLETE_POST_MS, Math.max(1, remComplete));
                const retried = await withBoundedSignal(retryTimeout, controller.signal, (sig) =>
                  faceLoginApi.complete(attemptId, sig),
                );
                return accept(retried.session, retried.targetRole);
              }
              if (status.state !== 'completing' && status.state !== 'processing') {
                return { success: false, message: 'Lượt nhận diện đã kết thúc. Vui lòng thử lại.' };
              }
            }
          } catch (recoveryError) {
            if (isCancelled()) {
              return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
            }
            if (recoveryError instanceof ApiError && [401, 403, 404, 410].includes(recoveryError.statusCode)) {
              return { success: false, message: recoveryError.message };
            }
          }

          if (isCancelled()) {
            return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
          }
          return { success: false, message: COMPLETE_INDETERMINATE_MESSAGE };
        } finally {
          clearTimeout(budgetTimer);
          if (activeCompleteRef.current?.controller === controller) {
            activeCompleteRef.current = null;
          }
        }
      }
    )();

    // Prevent unhandled rejection if logout detaches and moves on after the 1s settle cap
    void runComplete.catch(() => undefined);
    activeCompleteRef.current = { attemptId, promise: runComplete, controller };
    return runComplete;
  }, [acceptSession]);

  const login = useCallback(async (identifier: string, password?: string, rememberMe = false) => {
    // Prioritize logout message if both flags are active; never queue or call loginApi while busy.
    if (isLoggingOutRef.current || activeLogoutPromiseRef.current) {
      showToast(BUSY_LOGOUT_MESSAGE, 'error', 'Không thể đăng nhập');
      return { success: false, message: BUSY_LOGOUT_MESSAGE };
    }
    if (activeCompleteRef.current) {
      showToast(BUSY_COMPLETE_MESSAGE, 'error', 'Không thể đăng nhập');
      return { success: false, message: BUSY_COMPLETE_MESSAGE };
    }

    if (!identifier || !password) {
      const errMsg = 'Vui lòng nhập đầy đủ thông tin đăng nhập';
      showToast(errMsg, 'error', "Không thể đăng nhập");
      return { success: false, message: errMsg };
    }

    const myEpoch = ++authEpochRef.current;
    try {
      const { session, targetRole } = await loginApi(identifier, password, rememberMe);
      if (isLoggingOutRef.current || authEpochRef.current !== myEpoch) {
        return { success: false, message: 'Lượt đăng nhập đã được hủy.' };
      }
      acceptSession(session, rememberMe);

      return { success: true, role: targetRole };
    } catch (error: unknown) {
      authLogger.error('Login error:', error);
      const err = error as Error;
      const errMsg = err.message === 'Invalid username/email or password'
        ? 'Tài khoản hoặc mật khẩu không chính xác!'
        : (err.message || 'Xác thực thất bại! Vui lòng thử lại.');
      showToast(errMsg, 'error', "Không thể đăng nhập");
      return { success: false, message: errMsg };
    }
  }, [acceptSession, showToast]);

  const logout = useCallback(async () => {
    if (activeLogoutPromiseRef.current) {
      return activeLogoutPromiseRef.current;
    }

    // 1. Set logout flag and increment epoch immediately
    isLoggingOutRef.current = true;
    authEpochRef.current += 1;
    setIsLoggingOut(true);

    // 2. Abort any active complete/recovery and snapshot its promise
    const activeComplete = activeCompleteRef.current;
    if (activeComplete) {
      activeComplete.controller.abort(new DOMException('Cancelled by logout.', 'AbortError'));
    }

    const logoutPromise = (async () => {
      // Invalidate old local session immediately at start of logout
      bumpGlobalSession(null);
      setCurrentUser(null);
      setSessionId(globalSessionId);
      sessionStorage.removeItem('userSession');
      localStorage.removeItem('userSession');
      localStorage.removeItem('token');

      queryClient.clear();
      notifications?.clearAll(true);
      try {
        sessionStorage.removeItem('smartface_notifications_cache');
        localStorage.removeItem('smartface_notifications_cache');
      } catch {
        // Ignore
      }

      // 3. Wait at most 1 second for the snapshotted complete promise to settle
      if (activeComplete) {
        let settleTimer: ReturnType<typeof setTimeout> | null = null;
        try {
          await Promise.race([
            activeComplete.promise.catch(() => undefined),
            new Promise<void>(resolve => {
              settleTimer = setTimeout(resolve, FACE_LOGIN_TIMEOUTS.LOGOUT_SETTLE_MS);
            }),
          ]);
        } finally {
          if (settleTimer !== null) clearTimeout(settleTimer);
        }
      }

      // 4. Send POST logout after complete settles (or 1s cap) with a 4s transport timeout
      let logoutDelivered = false;
      try {
        await withBoundedSignal(FACE_LOGIN_TIMEOUTS.LOGOUT_MS, undefined, (sig) => logoutApi(sig));
        logoutDelivered = true;
      } catch {
        // Network/timeout failure on logout: do not claim server session cookie was definitely cleared
      }

      if (logoutDelivered) {
        showToast('Đã đăng xuất khỏi hệ thống', 'info', "Đăng xuất");
      } else {
        showToast('Đã xóa phiên cục bộ, nhưng chưa xác nhận được với máy chủ. Vui lòng kiểm tra kết nối.', 'warning', 'Đăng xuất');
      }
    })();

    activeLogoutPromiseRef.current = logoutPromise;
    try {
      await logoutPromise;
    } finally {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
      activeLogoutPromiseRef.current = null;
    }
  }, [queryClient, showToast, notifications]);

  const switchRole = useCallback((newRole: Role, employeesFallback: Employee[] = []) => {
    if (!import.meta.env.DEV) {
      showToast('Tính năng chuyển đổi vai trò chỉ khả dụng ở môi trường Development!', 'error', "Không thể chuyển vai trò");
      return;
    }

    notifications?.clearAll(true);

    if (newRole === 'admin') {
      setCurrentUser(DEFAULT_USERS.admin);
      sessionStorage.setItem('userSession', JSON.stringify(DEFAULT_USERS.admin));
      showToast('[DEV ONLY] Đã chuyển đổi sang vai trò: Quản trị viên (Admin)', 'info', "Chuyển vai trò");
      return;
    }

    const matched = employeesFallback.find(e =>
      newRole === 'manager'
        ? e.position?.toLowerCase().includes('lead') || e.position?.toLowerCase().includes('manager')
        : !e.position?.toLowerCase().includes('manager'),
    ) || employeesFallback[0];

    if (matched) {
      const session: UserSession = {
        username: matched.employee_id || matched.email || 'employee',
        employee_id: matched.employee_id,
        full_name: matched.full_name,
        email: matched.email || '',
        role: newRole,
        position: matched.position || (newRole === 'manager' ? 'Manager' : 'Employee'),
        department: matched.department || 'Chung',
        avatar: matched.avatar || '',
      };
      setCurrentUser(session);
      sessionStorage.setItem('userSession', JSON.stringify(session));
    } else {
      setCurrentUser(DEFAULT_USERS[newRole]);
      sessionStorage.setItem('userSession', JSON.stringify(DEFAULT_USERS[newRole]));
    }
    showToast(`[DEV ONLY] Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'info', "Chuyển vai trò");
  }, [showToast]);

  const setCurrentUserSession = useCallback((session: UserSession | null) => {
    if (!session || session.username !== globalCurrentUsername) {
      bumpGlobalSession(session);
      setSessionId(globalSessionId);
    }
    setCurrentUser(session);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        sessionId,
        isInitializing,
        isLoading: isInitializing,
        isLoggingOut,
        login,
        completeFaceLogin,
        logout,
        switchRole,
        setCurrentUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
