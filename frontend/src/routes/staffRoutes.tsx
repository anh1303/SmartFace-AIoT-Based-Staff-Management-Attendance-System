import { RouteObject, Navigate } from 'react-router-dom';

/**
 * Điều hướng tương thích ngược từ /app/staff sang /app/employee
 */
export const staffRoutes: RouteObject = {
  path: '/app/staff',
  children: [
    { index: true, element: <Navigate to="/app/employee/dashboard" replace /> },
    { path: 'dashboard', element: <Navigate to="/app/employee/dashboard" replace /> },
    { path: 'profile', element: <Navigate to="/app/employee/profile" replace /> },
    { path: 'schedule', element: <Navigate to="/app/employee/schedule" replace /> },
    { path: 'attendance', element: <Navigate to="/app/employee/attendance" replace /> },
    { path: 'salary-estimate', element: <Navigate to="/app/employee/salary-estimate" replace /> },
    { path: 'salary-history', element: <Navigate to="/app/employee/salary-history" replace /> },
    { path: '*', element: <Navigate to="/app/employee/dashboard" replace /> },
  ],
};
