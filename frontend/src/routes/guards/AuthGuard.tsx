import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { LoadingScreen } from '../../components/common/LoadingScreen';

interface AuthGuardProps {
  allowedRoles?: Role[];
  children?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ allowedRoles, children }) => {
  const { currentUser, isInitializing } = useAuth();
  const location = useLocation();

  // 1. Prevent race condition: Wait for meApi() verification to finish before making routing decisions
  if (isInitializing) {
    return <LoadingScreen message="Đang xác thực phiên làm việc..." subMessage="Xác thực cookie bảo mật..." />;
  }

  // 2. Unauthenticated: Redirect to login with return location state
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3. Role authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const isAdmin =
      currentUser.role === 'admin' ||
      currentUser.role_name?.toUpperCase() === 'ADMIN';

    // Admin có tất cả quyền trong hệ thống
    const hasRole = isAdmin || allowedRoles.includes(currentUser.role);
    if (!hasRole) {
      // Nhân viên chỉ được xem các trang trong /app/employee
      if (currentUser.role === 'employee') {
        return <Navigate to="/app/employee/dashboard" replace />;
      }
      return <Navigate to="/app/manager/dashboard" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
