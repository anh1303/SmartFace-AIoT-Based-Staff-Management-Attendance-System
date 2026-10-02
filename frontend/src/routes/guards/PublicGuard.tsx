import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../../components/common/LoadingScreen';

interface PublicGuardProps {
  children?: React.ReactNode;
}

/**
 * PublicGuard ensures that authenticated users visiting public-only routes (such as /login)
 * are seamlessly redirected to their respective dashboards instead of seeing the login form again.
 */
export const PublicGuard: React.FC<PublicGuardProps> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingScreen message="Đang kiểm tra trạng thái đăng nhập..." />;
  }

  if (currentUser) {
    // If the user was redirected to /login with a previous target location, send them there
    const fromLocation = (location.state as { from?: { pathname?: string } })?.from?.pathname;
    const defaultDashboard =
      currentUser.role === 'manager' ? '/app/manager/dashboard' : '/app/staff/dashboard';

    const target = fromLocation && fromLocation !== '/login' ? fromLocation : defaultDashboard;
    return <Navigate to={target} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
