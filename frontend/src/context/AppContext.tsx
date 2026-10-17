import React, { createContext, useContext, useCallback, useMemo } from 'react';
import {
  Employee,
  WorkShift,
  AttendanceRecord,
  PayrollRecord,
  BonusPenaltyPolicy,
  UserSession,
  Role,
  ToastMessage,
} from '../types';
import { ToastProvider, useToast } from './ToastContext';
import { AuthProvider, useAuth } from './AuthContext';
import { EmployeeProvider, useEmployeeContext } from './EmployeeContext';
import { ShiftProvider, useShiftContext } from './ShiftContext';
import { AttendanceProvider, useAttendanceContext } from './AttendanceContext';
import { PayrollProvider, usePayrollContext } from './PayrollContext';

export interface AppContextType {
  currentUser: UserSession | null;
  role: Role;
  isInitializing: boolean;
  isLoading: boolean;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; message?: string; role?: Role }>;
  logout: () => void;
  switchRole: (role: Role) => void;

  // Employees
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  toggleEmployeeStatus: (id: string) => void;

  // Shifts
  workShifts: WorkShift[];
  assignOrUpdateShift: (shift: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => void;

  // Attendance
  attendance: AttendanceRecord[];
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => void;

  // Payroll
  payroll: PayrollRecord[];
  bonusPenalty: BonusPenaltyPolicy | null;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  generatePayroll: (period: string) => Promise<void>;
  updatePayrollItem: (id: string, updates: Partial<PayrollRecord>) => void;
  finalizePayrollPeriod: (period: string) => void;
  unlockPayrollPeriod: (period: string) => void;
  updateBonusPenalty: (data: { overtime_rate?: number; late_early_penalty?: number; description?: string }) => Promise<void>;

  // Toasts
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppConsumerBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const toast = useToast();
  const employeeCtx = useEmployeeContext();
  const shiftCtx = useShiftContext();
  const attendanceCtx = useAttendanceContext();
  const payrollCtx = usePayrollContext();

  const switchRoleWithEmployees = useCallback((role: Role) => {
    auth.switchRole(role, employeeCtx.employees);
  }, [auth, employeeCtx.employees]);

  const value: AppContextType = useMemo(() => ({
    // Auth
    currentUser: auth.currentUser,
    role: auth.role,
    isInitializing: auth.isInitializing,
    isLoading: auth.isLoading,
    login: auth.login,
    logout: auth.logout,
    switchRole: switchRoleWithEmployees,

    // Employees
    employees: employeeCtx.employees,
    addEmployee: employeeCtx.addEmployee,
    updateEmployee: employeeCtx.updateEmployee,
    deleteEmployee: employeeCtx.deleteEmployee,
    toggleEmployeeStatus: employeeCtx.toggleEmployeeStatus,

    // Shifts
    workShifts: shiftCtx.workShifts,
    assignOrUpdateShift: shiftCtx.assignOrUpdateShift,

    // Attendance
    attendance: attendanceCtx.attendance,
    addAttendanceRecord: attendanceCtx.addAttendanceRecord,

    // Payroll
    payroll: payrollCtx.payroll,
    bonusPenalty: payrollCtx.bonusPenalty,
    selectedPeriod: payrollCtx.selectedPeriod,
    setSelectedPeriod: payrollCtx.setSelectedPeriod,
    generatePayroll: async (period: string) => {
      await payrollCtx.generatePayroll(period);
    },
    updatePayrollItem: payrollCtx.updatePayrollItem,
    finalizePayrollPeriod: payrollCtx.finalizePayrollPeriod,
    unlockPayrollPeriod: payrollCtx.unlockPayrollPeriod,
    updateBonusPenalty: async (data) => {
      await payrollCtx.updateBonusPenalty(data);
    },

    // Toasts
    toasts: toast.toasts,
    showToast: toast.showToast,
    removeToast: toast.removeToast,
  }), [
    auth.currentUser,
    auth.role,
    auth.isInitializing,
    auth.isLoading,
    auth.login,
    auth.logout,
    switchRoleWithEmployees,
    employeeCtx.employees,
    employeeCtx.addEmployee,
    employeeCtx.updateEmployee,
    employeeCtx.deleteEmployee,
    employeeCtx.toggleEmployeeStatus,
    shiftCtx.workShifts,
    shiftCtx.assignOrUpdateShift,
    attendanceCtx.attendance,
    attendanceCtx.addAttendanceRecord,
    payrollCtx.payroll,
    payrollCtx.bonusPenalty,
    payrollCtx.selectedPeriod,
    payrollCtx.setSelectedPeriod,
    payrollCtx.generatePayroll,
    payrollCtx.updatePayrollItem,
    payrollCtx.finalizePayrollPeriod,
    payrollCtx.unlockPayrollPeriod,
    payrollCtx.updateBonusPenalty,
    toast.toasts,
    toast.showToast,
    toast.removeToast,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <AuthProvider>
        <EmployeeProvider>
          <ShiftProvider>
            <AttendanceProvider>
              <PayrollProvider>
                <AppConsumerBridge>{children}</AppConsumerBridge>
              </PayrollProvider>
            </AttendanceProvider>
          </ShiftProvider>
        </EmployeeProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Re-export individual domain hooks and providers for clean modular consumption
export { useEmployeeContext, EmployeeProvider } from './EmployeeContext';
export { useShiftContext, ShiftProvider } from './ShiftContext';
export { useAttendanceContext, AttendanceProvider } from './AttendanceContext';
export { usePayrollContext, PayrollProvider } from './PayrollContext';
export { useAuth, AuthProvider } from './AuthContext';
export { useToast, ToastProvider } from './ToastContext';