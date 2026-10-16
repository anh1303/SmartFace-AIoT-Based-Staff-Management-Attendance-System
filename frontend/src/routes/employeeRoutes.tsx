import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthGuard } from './guards/AuthGuard';

const EmployeeDashboard = lazy(() =>
  import('../pages/employee/EmployeeDashboard').then(module => ({ default: module.EmployeeDashboard }))
);
const EmployeeProfile = lazy(() =>
  import('../pages/employee/EmployeeProfile').then(module => ({ default: module.EmployeeProfile }))
);
const EmployeeSchedule = lazy(() =>
  import('../pages/employee/EmployeeSchedule').then(module => ({ default: module.EmployeeSchedule }))
);
const EmployeeAttendance = lazy(() =>
  import('../pages/employee/EmployeeAttendance').then(module => ({ default: module.EmployeeAttendance }))
);
const EmployeeSalaryEstimate = lazy(() =>
  import('../pages/employee/EmployeeSalaryEstimate').then(module => ({ default: module.EmployeeSalaryEstimate }))
);
const EmployeeSalaryHistory = lazy(() =>
  import('../pages/employee/EmployeeSalaryHistory').then(module => ({ default: module.EmployeeSalaryHistory }))
);

export const employeeRoutes: RouteObject = {
  path: '/app/employee',
  element: (
    <AuthGuard>
      <AppLayout />
    </AuthGuard>
  ),
  children: [
    { index: true, element: <Navigate to="/app/employee/dashboard" replace /> },
    { path: 'dashboard', element: <EmployeeDashboard /> },
    { path: 'profile', element: <EmployeeProfile /> },
    { path: 'schedule', element: <EmployeeSchedule /> },
    { path: 'attendance', element: <EmployeeAttendance /> },
    { path: 'salary-estimate', element: <EmployeeSalaryEstimate /> },
    { path: 'salary-history', element: <EmployeeSalaryHistory /> },
  ],
};

// Alias export for backwards compatibility
export const staffRoutes = employeeRoutes;
