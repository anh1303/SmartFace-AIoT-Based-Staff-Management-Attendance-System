import React from 'react';
import { ToastProvider } from './ToastContext';
import { AuthProvider } from './AuthContext';
import { EmployeeProvider } from './EmployeeContext';
import { ShiftProvider } from './ShiftContext';
import { AttendanceProvider } from './AttendanceContext';
import { PayrollProvider } from './PayrollContext';
import { NotificationProvider } from '../features/notifications';
import { OperationsProvider } from '../features/operations';

/** Compose shared providers without combining unrelated domain state. */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <ToastProvider>
      <AuthProvider>
        <OperationsProvider>
          <EmployeeProvider>
            <ShiftProvider>
              <AttendanceProvider>
                <PayrollProvider>{children}</PayrollProvider>
              </AttendanceProvider>
            </ShiftProvider>
          </EmployeeProvider>
        </OperationsProvider>
      </AuthProvider>
    </ToastProvider>
  </NotificationProvider>
);
