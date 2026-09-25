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
import { useEmployees } from '../hooks/useEmployees';
import { useShifts } from '../hooks/useShifts';
import { useAttendance } from '../hooks/useAttendance';
import { usePayroll } from '../hooks/usePayroll';

export interface AppContextType {
  currentUser: UserSession | null;
  role: Role;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; message?: string; role?: Role }>;
  logout: () => void;
  switchRole: (role: Role) => void;

  // Employees
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
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
  const employeesHook = useEmployees();
  const shiftsHook = useShifts();
  const attendanceHook = useAttendance();
  const payrollHook = usePayroll();

  const switchRoleWithEmployees = useCallback((role: Role) => {
    auth.switchRole(role, employeesHook.employees);
  }, [auth, employeesHook.employees]);

  const value: AppContextType = useMemo(() => ({
    // Auth
    currentUser: auth.currentUser,
    role: auth.role,
    login: auth.login,
    logout: auth.logout,
    switchRole: switchRoleWithEmployees,

    // Employees
    employees: employeesHook.employees,
    addEmployee: employeesHook.addEmployee,
    updateEmployee: employeesHook.updateEmployee,
    toggleEmployeeStatus: employeesHook.toggleEmployeeStatus,

    // Shifts
    workShifts: shiftsHook.workShifts,
    assignOrUpdateShift: shiftsHook.assignOrUpdateShift,

    // Attendance
    attendance: attendanceHook.attendance,
    addAttendanceRecord: attendanceHook.addAttendanceRecord,

    // Payroll
    payroll: payrollHook.payroll,
    bonusPenalty: payrollHook.bonusPenalty,
    selectedPeriod: payrollHook.selectedPeriod,
    setSelectedPeriod: payrollHook.setSelectedPeriod,
    generatePayroll: async (period: string) => {
      await payrollHook.generatePayroll(period);
    },
    updatePayrollItem: payrollHook.updatePayrollItem,
    finalizePayrollPeriod: payrollHook.finalizePayrollPeriod,
    unlockPayrollPeriod: payrollHook.unlockPayrollPeriod,
    updateBonusPenalty: async (data) => {
      await payrollHook.updateBonusPenalty(data);
    },

    // Toasts
    toasts: toast.toasts,
    showToast: toast.showToast,
    removeToast: toast.removeToast,
  }), [
    auth.currentUser,
    auth.role,
    auth.login,
    auth.logout,
    switchRoleWithEmployees,
    employeesHook.employees,
    employeesHook.addEmployee,
    employeesHook.updateEmployee,
    employeesHook.toggleEmployeeStatus,
    shiftsHook.workShifts,
    shiftsHook.assignOrUpdateShift,
    attendanceHook.attendance,
    attendanceHook.addAttendanceRecord,
    payrollHook.payroll,
    payrollHook.bonusPenalty,
    payrollHook.selectedPeriod,
    payrollHook.setSelectedPeriod,
    payrollHook.generatePayroll,
    payrollHook.updatePayrollItem,
    payrollHook.finalizePayrollPeriod,
    payrollHook.unlockPayrollPeriod,
    payrollHook.updateBonusPenalty,
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
        <AppConsumerBridge>{children}</AppConsumerBridge>
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