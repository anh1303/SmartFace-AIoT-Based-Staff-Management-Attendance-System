import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthGuard } from './guards/AuthGuard';
import '../pages/employee/employee.css';

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
const EmployeeBiometrics = lazy(() =>
  import('../pages/employee/EmployeeBiometrics').then(module => ({ default: module.EmployeeBiometrics }))
);

export const employeeRoutes: RouteObject = {
  path: '/app/employee',
  element: (
    <AuthGuard allowedRoles={['admin', 'manager', 'employee']}>
      <AppLayout />
    </AuthGuard>
  ),
  children: [
    { index: true, element: <Navigate to="/app/employee/dashboard" replace /> },
    { path: 'dashboard', element: <EmployeeDashboard /> },
    { path: 'profile', element: <EmployeeProfile /> },
    { path: 'schedule', element: <EmployeeSchedule /> },
    { path: 'attendance', element: <EmployeeAttendance /> },
    { path: 'biometrics', element: <EmployeeBiometrics /> },
    { path: 'payroll', element: <EmployeeSalaryEstimate /> },
    { path: 'salary-estimate', element: <Navigate to="/app/employee/payroll" replace /> },
    { path: 'salary-history', element: <Navigate to="/app/employee/payroll" replace /> },
  ],
};

