import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserSession, Role, Employee } from '../types';
import { loginApi, logoutApi, meApi, DEFAULT_USERS } from '../api/authApi';
import { useToast } from './ToastContext';
import { useOptionalNotifications } from '../features/notifications';
import { logger } from '../utils/logger';

const authLogger = logger.child('AuthContext');

interface AuthContextType {
  currentUser: UserSession | null;
  role: Role;
  isInitializing: boolean;
  isLoading: boolean;
  login: (identifier: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string; role?: Role }>;
  logout: () => void;
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
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const role: Role = currentUser?.role || 'employee';

  useEffect(() => {
    let isMounted = true;

    // Validate session on mount via HttpOnly cookie (Do not blindly trust storage)
    meApi()
      .then(session => {
        if (!isMounted) return;
        if (session) {
          setCurrentUser(session);
          sessionStorage.setItem('userSession', JSON.stringify(session));
        } else {
          // If cookie verification fails or expires, clear stale session
          setCurrentUser(null);
          sessionStorage.removeItem('userSession');
          localStorage.removeItem('userSession');
        }
      })
      .catch(error => {
        authLogger.warn('Session verification failed on mount:', error);
        if (!isMounted) return;
        setCurrentUser(null);
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
      setCurrentUser(session);

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

    setCurrentUser(null);
    sessionStorage.removeItem('userSession');
    localStorage.removeItem('userSession');
    localStorage.removeItem('token');
    showToast('Đã đăng xuất khỏi hệ thống', 'info');
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

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isInitializing,
        isLoading: isInitializing,
        login,
        logout,
        switchRole,
        setCurrentUserSession: setCurrentUser,
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
