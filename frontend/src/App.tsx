import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';

// Staff Pages
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { StaffProfile } from './pages/staff/StaffProfile';
import { StaffSchedule } from './pages/staff/StaffSchedule';
import { StaffAttendance } from './pages/staff/StaffAttendance';
import { StaffSalaryEstimate } from './pages/staff/StaffSalaryEstimate';
import { StaffSalaryHistory } from './pages/staff/StaffSalaryHistory';

// Manager Pages
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { ManagerEmployeeList } from './pages/manager/ManagerEmployeeList';
import { ManagerSchedule } from './pages/manager/ManagerSchedule';
import { ManagerAttendanceMonitor } from './pages/manager/ManagerAttendanceMonitor';
import { ManagerReports } from './pages/manager/ManagerReports';
import { ManagerPayroll } from './pages/manager/ManagerPayroll';
import { ManagerBiometrics } from './pages/manager/ManagerBiometrics';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Staff Area */}
          <Route path="/app/staff" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/staff/dashboard" replace />} />
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="profile" element={<StaffProfile />} />
            <Route path="schedule" element={<StaffSchedule />} />
            <Route path="attendance" element={<StaffAttendance />} />
            <Route path="salary-estimate" element={<StaffSalaryEstimate />} />
            <Route path="salary-history" element={<StaffSalaryHistory />} />
          </Route>

          {/* Manager Area */}
          <Route path="/app/manager" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/manager/dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="employees" element={<ManagerEmployeeList />} />
            <Route path="schedule" element={<ManagerSchedule />} />
            <Route path="attendance" element={<ManagerAttendanceMonitor />} />
            <Route path="biometrics" element={<ManagerBiometrics />} />
            <Route path="reports" element={<ManagerReports />} />
            <Route path="payroll" element={<ManagerPayroll />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
