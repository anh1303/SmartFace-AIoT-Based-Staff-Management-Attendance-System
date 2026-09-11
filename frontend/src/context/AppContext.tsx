import React, { createContext, useContext, useState } from 'react';
import { 
  Employee, 
  WorkShift, 
  AttendanceRecord, 
  PayrollRecord, 
  UserSession, 
  Role, 
  ToastMessage 
} from '../types';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_SHIFTS, 
  INITIAL_ATTENDANCE, 
  INITIAL_PAYROLL, 
  DEMO_USERS 
} from '../mocks/initialData';

interface AppContextType {
  currentUser: UserSession | null;
  role: Role;
  login: (roleOrEmail: Role | string, emailOrPass?: string) => void;
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
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  updatePayrollItem: (id: string, updates: Partial<PayrollRecord>) => void;
  finalizePayrollPeriod: (period: string) => void;
  unlockPayrollPeriod: (period: string) => void;
  
  // Toasts
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Manager for rapid exploration, or Staff
  const [currentUser, setCurrentUser] = useState<UserSession | null>(DEMO_USERS.staff);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>(INITIAL_SHIFTS);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(INITIAL_PAYROLL);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("2026-08");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const role: Role = currentUser?.role || 'staff';

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const login = (roleOrEmail: Role | string, emailOrPass?: string) => {
    const isManager = 
      roleOrEmail === 'manager' || 
      roleOrEmail.toLowerCase().includes('manager') || 
      roleOrEmail.toLowerCase().includes('admin') || 
      roleOrEmail.toUpperCase() === 'NV-003';

    const targetRole: Role = isManager ? 'manager' : 'staff';
    const baseSession = DEMO_USERS[targetRole];
    
    // Find matching employee if available
    const matchedEmp = employees.find(e => 
      e.email.toLowerCase() === roleOrEmail.toLowerCase() || 
      e.employee_id.toUpperCase() === roleOrEmail.toUpperCase()
    );

    const session: UserSession = matchedEmp ? {
      employee_id: matchedEmp.employee_id,
      full_name: matchedEmp.full_name,
      email: matchedEmp.email,
      role: targetRole,
      position: matchedEmp.position,
      department: matchedEmp.department,
      avatar: matchedEmp.avatar || baseSession.avatar
    } : {
      ...baseSession,
      email: (emailOrPass && emailOrPass.includes('@')) ? emailOrPass : baseSession.email
    };

    setCurrentUser(session);
    showToast(`Đăng nhập thành công với vai trò ${targetRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}`, 'success');
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Đã đăng xuất khỏi hệ thống', 'info');
  };

  const switchRole = (newRole: Role) => {
    setCurrentUser(DEMO_USERS[newRole]);
    showToast(`Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}`, 'info');
  };

  // Employee CRUD
  const addEmployee = (newEmp: Omit<Employee, 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const created: Employee = {
      ...newEmp,
      created_at: now,
      updated_at: now,
    };
    setEmployees(prev => [created, ...prev]);
    showToast(`Đã thêm nhân viên ${newEmp.full_name} (${newEmp.employee_id})`, 'success');
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.employee_id === id) {
        return {
          ...emp,
          ...updates,
          updated_at: new Date().toISOString()
        };
      }
      return emp;
    }));
    showToast(`Đã cập nhật thông tin nhân viên ${id}`, 'success');
  };

  const toggleEmployeeStatus = (id: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.employee_id === id) {
        const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        return {
          ...emp,
          status: nextStatus,
          updated_at: new Date().toISOString()
        };
      }
      return emp;
    }));
    showToast(`Đã thay đổi trạng thái nhân viên ${id}`, 'info');
  };

  // Shift assignment
  const assignOrUpdateShift = (shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => {
    setWorkShifts(prev => {
      const existingIndex = prev.findIndex(
        s => s.employee_id === shiftData.employee_id && s.date === shiftData.date
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...shiftData,
          shift_id: updated[existingIndex].shift_id
        };
        return updated;
      } else {
        const newShift: WorkShift = {
          ...shiftData,
          shift_id: shiftData.shift_id || `S-${Date.now()}`
        };
        return [...prev, newShift];
      }
    });
    showToast(`Đã lưu lịch làm việc cho ${shiftData.date}`, 'success');
  };

  // Attendance
  const addAttendanceRecord = (record: Omit<AttendanceRecord, 'attendance_id'>) => {
    const newRecord: AttendanceRecord = {
      ...record,
      attendance_id: `ATT-${Date.now()}`
    };
    setAttendance(prev => [newRecord, ...prev]);
    showToast(`Đã ghi nhận chấm công: ${record.type} lúc ${new Date(record.timestamp).toLocaleTimeString()}`, 'success');
  };

  // Payroll
  const updatePayrollItem = (id: string, updates: Partial<PayrollRecord>) => {
    setPayroll(prev => prev.map(p => {
      if (p.payroll_id === id) {
        const updated = { ...p, ...updates };
        // Recalculate total_paid
        updated.total_paid = Math.max(0, updated.base_salary + updated.allowance - updated.deduction);
        return updated;
      }
      return p;
    }));
    showToast('Đã lưu thay đổi phiếu lương', 'success');
  };

  const finalizePayrollPeriod = (period: string) => {
    setPayroll(prev => prev.map(p => {
      if (p.period === period) {
        return { ...p, status: 'FINALIZED' };
      }
      return p;
    }));
    showToast(`Đã chốt bảng lương kỳ ${period}`, 'success');
  };

  const unlockPayrollPeriod = (period: string) => {
    setPayroll(prev => prev.map(p => {
      if (p.period === period) {
        return { ...p, status: 'PENDING' };
      }
      return p;
    }));
    showToast(`Đã mở khoá chỉnh sửa bảng lương kỳ ${period}`, 'warning');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        role,
        login,
        logout,
        switchRole,
        employees,
        addEmployee,
        updateEmployee,
        toggleEmployeeStatus,
        workShifts,
        assignOrUpdateShift,
        attendance,
        addAttendanceRecord,
        payroll,
        selectedPeriod,
        setSelectedPeriod,
        updatePayrollItem,
        finalizePayrollPeriod,
        unlockPayrollPeriod,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
