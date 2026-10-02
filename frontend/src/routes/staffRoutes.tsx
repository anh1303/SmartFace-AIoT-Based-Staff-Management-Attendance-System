import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthGuard } from './guards/AuthGuard';

const StaffDashboard = lazy(() =>
  import('../pages/staff/StaffDashboard').then(module => ({ default: module.StaffDashboard }))
);
const StaffProfile = lazy(() =>
  import('../pages/staff/StaffProfile').then(module => ({ default: module.StaffProfile }))
);
const StaffSchedule = lazy(() =>
  import('../pages/staff/StaffSchedule').then(module => ({ default: module.StaffSchedule }))
);
const StaffAttendance = lazy(() =>
  import('../pages/staff/StaffAttendance').then(module => ({ default: module.StaffAttendance }))
);
const StaffSalaryEstimate = lazy(() =>
  import('../pages/staff/StaffSalaryEstimate').then(module => ({ default: module.StaffSalaryEstimate }))
);
const StaffSalaryHistory = lazy(() =>
  import('../pages/staff/StaffSalaryHistory').then(module => ({ default: module.StaffSalaryHistory }))
);

export const staffRoutes: RouteObject = {
  path: '/app/staff',
  element: (
    <AuthGuard>
      <AppLayout />
    </AuthGuard>
  ),
  children: [
    { index: true, element: <Navigate to="/app/staff/dashboard" replace /> },
    { path: 'dashboard', element: <StaffDashboard /> },
    { path: 'profile', element: <StaffProfile /> },
    { path: 'schedule', element: <StaffSchedule /> },
    { path: 'attendance', element: <StaffAttendance /> },
    { path: 'salary-estimate', element: <StaffSalaryEstimate /> },
    { path: 'salary-history', element: <StaffSalaryHistory /> },
  ],
};
