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
    const hasRole = allowedRoles.includes(currentUser.role);
    if (!hasRole) {
      // If employee tries to enter manager area, bounce to staff dashboard
      if (currentUser.role === 'employee') {
        return <Navigate to="/app/staff/dashboard" replace />;
      }
      // If manager tries to enter an exclusive area or other roles, redirect appropriately
      return <Navigate to="/app/manager/dashboard" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
