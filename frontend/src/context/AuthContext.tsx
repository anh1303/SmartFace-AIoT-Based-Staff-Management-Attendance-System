import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserSession, Role, Employee } from '../types';
import { loginApi, logoutApi, meApi, DEFAULT_USERS } from '@/features/auth';
import { useToast } from './ToastContext';
import { useOptionalNotifications } from '../features/notifications';
import { logger } from '../utils/logger';

const authLogger = logger.child('AuthContext');

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

interface AuthContextType {
  currentUser: UserSession | null;
  role: Role;
  sessionId: number;
  isInitializing: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  login: (identifier: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string; role?: Role }>;
  logout: () => Promise<void>;
  switchRole: (role: Role, employeesFallback?: Employee[]) => void;
  setCurrentUserSession: (session: UserSession | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const activeLogoutPromiseRef = useRef<Promise<void> | null>(null);

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
    };
  }, []);

  const login = useCallback(async (identifier: string, password?: string, rememberMe = false) => {
    // If a logout is currently in flight, await it first so its Set-Cookie: token=; Max-Age=0
    // does not arrive later and delete this new login's session cookie.
    if (activeLogoutPromiseRef.current) {
      try {
        await activeLogoutPromiseRef.current;
      } catch {
        // Ignore logout errors
      }
    }

    if (!identifier || !password) {
      const errMsg = 'Vui lòng nhập đầy đủ thông tin đăng nhập';
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }

    try {
      // Clear any prior user's cached queries and notifications before setting up new session
      queryClient.clear();
      notifications?.clearAll(true);

      const { session, targetRole } = await loginApi(identifier, password, rememberMe);
      bumpGlobalSession(session);
      setCurrentUser(session);
      setSessionId(globalSessionId);

      if (rememberMe) {
        localStorage.setItem('userSession', JSON.stringify(session));
      } else {
        sessionStorage.setItem('userSession', JSON.stringify(session));
        localStorage.removeItem('userSession');
      }

      return { success: true, role: targetRole };
    } catch (error: unknown) {
      authLogger.error('Login error:', error);
      const err = error as Error;
      const errMsg = err.message === 'Invalid username/email or password'
        ? 'Tài khoản hoặc mật khẩu không chính xác!'
        : (err.message || 'Xác thực thất bại! Vui lòng thử lại.');
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }
  }, [queryClient, showToast, notifications]);

  const logout = useCallback(async () => {
    if (activeLogoutPromiseRef.current) {
      return activeLogoutPromiseRef.current;
    }

    setIsLoggingOut(true);

    const logoutPromise = (async () => {
      // Invalidate old session immediately at start of logout
      bumpGlobalSession(null);
      setCurrentUser(null);
      setSessionId(globalSessionId);
      sessionStorage.removeItem('userSession');
      localStorage.removeItem('userSession');
      localStorage.removeItem('token');

      // 1. Mandatory: Wipe React Query cache to prevent data leaks between sessions
      queryClient.clear();

      // 2. Wipe all notifications completely (no old notifications retained on logout)
      notifications?.clearAll(true);
      try {
        sessionStorage.removeItem('smartface_notifications_cache');
        localStorage.removeItem('smartface_notifications_cache');
      } catch {
        // Ignore
      }

      try {
        await logoutApi();
      } catch {
        // Ignore network errors on logout
      }

      showToast('Đã đăng xuất khỏi hệ thống', 'info');
    })();

    activeLogoutPromiseRef.current = logoutPromise;
    try {
      await logoutPromise;
    } finally {
      setIsLoggingOut(false);
      activeLogoutPromiseRef.current = null;
    }
  }, [queryClient, showToast, notifications]);

  const switchRole = useCallback((newRole: Role, employeesFallback: Employee[] = []) => {
    // 2. Lock switchRole in production builds using import.meta.env.DEV
    if (!import.meta.env.DEV) {
      showToast('Tính năng chuyển đổi vai trò chỉ khả dụng ở môi trường Development!', 'warning');
      return;
    }

    // Reset notifications when switching roles in DEV
    notifications?.clearAll(true);

    if (newRole === 'admin') {
      setCurrentUser(DEFAULT_USERS.admin);
      sessionStorage.setItem('userSession', JSON.stringify(DEFAULT_USERS.admin));
      showToast('[DEV ONLY] Đã chuyển đổi sang vai trò: Quản trị viên (Admin)', 'info');
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
    showToast(`[DEV ONLY] Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'info');
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
