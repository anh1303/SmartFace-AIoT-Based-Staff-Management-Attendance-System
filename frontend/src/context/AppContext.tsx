import React from 'react';
import { ToastProvider } from './ToastContext';
import { AuthProvider } from '@/features/auth';
import { EmployeeProvider } from '@/features/employees';
import { ShiftProvider } from '@/features/schedules';
import { AttendanceProvider } from '@/features/attendances';
import { PayrollProvider } from '@/features/payrolls';
import { NotificationProvider } from '@/features/notifications';
import { OperationsProvider } from '@/features/operations';

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
