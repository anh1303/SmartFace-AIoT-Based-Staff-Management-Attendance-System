import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserSession, Role, Employee } from '../types';
import { loginApi, logoutApi, meApi, DEFAULT_USERS } from '../api/authApi';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: UserSession | null;
  role: Role;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; message?: string; role?: Role }>;
  logout: () => void;
  switchRole: (role: Role, employeesFallback?: Employee[]) => void;
  setCurrentUserSession: (session: UserSession | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('userSession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const role: Role = currentUser?.role || 'employee';

  useEffect(() => {
    // Validate session on mount via HttpOnly cookie (Do not blindly trust localStorage)
    meApi().then(session => {
      if (session) {
        setCurrentUser(session);
        localStorage.setItem('userSession', JSON.stringify(session));
      } else {
        // If cookie verification fails or expires, force logout state
        setCurrentUser(null);
        localStorage.removeItem('userSession');
      }
    });
  }, []);

  const login = useCallback(async (identifier: string, password?: string) => {
    if (!identifier || !password) {
      const errMsg = 'Vui lòng nhập đầy đủ thông tin đăng nhập';
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }

    try {
      // Clear any prior user's cached queries before setting up new session
      queryClient.clear();

      const { session, targetRole } = await loginApi(identifier, password);
      setCurrentUser(session);
      localStorage.setItem('userSession', JSON.stringify(session));

      showToast(`Đăng nhập thành công! Vai trò: ${targetRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'success');
      return { success: true, role: targetRole };
    } catch (error: unknown) {
      console.error('Login error:', error);
      const err = error as Error;
      const errMsg = err.message === 'Invalid username/email or password'
        ? 'Tài khoản hoặc mật khẩu không chính xác!'
        : (err.message || 'Xác thực thất bại! Vui lòng thử lại.');
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }
  }, [queryClient, showToast]);

  const logout = useCallback(async () => {
    // 1. Mandatory: Wipe React Query cache to prevent data leaks between sessions
    queryClient.clear();

    try {
      await logoutApi();
    } catch {
      // Ignore network errors on logout
    }

    setCurrentUser(null);
    localStorage.removeItem('userSession');
    localStorage.removeItem('token');
    showToast('Đã đăng xuất khỏi hệ thống', 'info');
  }, [queryClient, showToast]);

  const switchRole = useCallback((newRole: Role, employeesFallback: Employee[] = []) => {
    // 2. Lock switchRole in production builds using import.meta.env.DEV
    if (!import.meta.env.DEV) {
      showToast('Tính năng chuyển đổi vai trò chỉ khả dụng ở môi trường Development!', 'warning');
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
      localStorage.setItem('userSession', JSON.stringify(session));
    } else {
      setCurrentUser(DEFAULT_USERS[newRole]);
    }
    showToast(`[DEV ONLY] Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'info');
  }, [showToast]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
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
