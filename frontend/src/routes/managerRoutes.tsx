import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthGuard } from './guards/AuthGuard';

const ManagerDashboard = lazy(() =>
  import('../pages/manager/ManagerDashboard').then(module => ({ default: module.ManagerDashboard }))
);
const ManagerEmployeeList = lazy(() =>
  import('../pages/manager/ManagerEmployeeList').then(module => ({ default: module.ManagerEmployeeList }))
);
const ManagerSchedule = lazy(() =>
  import('../pages/manager/ManagerSchedule').then(module => ({ default: module.ManagerSchedule }))
);
const ManagerAttendanceMonitor = lazy(() =>
  import('../pages/manager/ManagerAttendanceMonitor').then(module => ({ default: module.ManagerAttendanceMonitor }))
);
const ManagerReports = lazy(() =>
  import('../pages/manager/ManagerReports').then(module => ({ default: module.ManagerReports }))
);
const ManagerPayroll = lazy(() =>
  import('../pages/manager/ManagerPayroll').then(module => ({ default: module.ManagerPayroll }))
);
const ManagerBiometrics = lazy(() =>
  import('../pages/manager/ManagerBiometrics').then(module => ({ default: module.ManagerBiometrics }))
);

export const managerRoutes: RouteObject = {
  path: '/app/manager',
  element: (
    <AuthGuard allowedRoles={['manager']}>
      <AppLayout />
    </AuthGuard>
  ),
  children: [
    { index: true, element: <Navigate to="/app/manager/dashboard" replace /> },
    { path: 'dashboard', element: <ManagerDashboard /> },
    { path: 'employees', element: <ManagerEmployeeList /> },
    { path: 'schedule', element: <ManagerSchedule /> },
    { path: 'attendance', element: <ManagerAttendanceMonitor /> },
    { path: 'biometrics', element: <ManagerBiometrics /> },
    { path: 'reports', element: <ManagerReports /> },
    { path: 'payroll', element: <ManagerPayroll /> },
  ],
};
