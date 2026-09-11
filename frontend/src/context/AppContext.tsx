import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('userSession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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

  const login = async (identifier: string, password?: string): Promise<{ success: boolean; message?: string; role?: Role }> => {
    if (!identifier || !password) {
      const errMsg = 'Vui lòng nhập đầy đủ thông tin đăng nhập';
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const resData = await response.json();

      if (response.ok && resData.success && resData.data) {
        const { user, accessToken } = resData.data;
        const targetRole: Role = user.role === 'manager' ? 'manager' : 'staff';
        
        const session: UserSession = {
          employee_id: user.employee_id || user.username || 'EMP-001',
          full_name: user.full_name || user.username,
          email: user.email || '',
          role: targetRole,
          position: user.position || (targetRole === 'manager' ? 'Manager' : 'Employee'),
          department: user.department || 'Chung',
          avatar: user.avatar || (targetRole === 'manager' ? DEMO_USERS.manager.avatar : DEMO_USERS.staff.avatar),
        };

        setCurrentUser(session);
        localStorage.setItem('userSession', JSON.stringify(session));
        localStorage.setItem('token', accessToken);

        showToast(`Đăng nhập thành công! Vai trò: ${targetRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}`, 'success');
        return { success: true, role: targetRole };
      } else {
        const errMsg = resData.message === 'Invalid username/email or password'
          ? 'Tài khoản hoặc mật khẩu không chính xác!'
          : (resData.message || 'Xác thực thất bại! Vui lòng thử lại.');
        showToast(errMsg, 'error');
        return { success: false, message: errMsg };
      }
    } catch (error) {
      console.error('Login API error:', error);
      const errMsg = 'Không thể kết nối đến máy chủ Backend (http://localhost:3000). Vui lòng đảm bảo Backend đang chạy!';
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('userSession');
    localStorage.removeItem('token');
    showToast('Đã đăng xuất khỏi hệ thống', 'info');
  };

  const switchRole = (newRole: Role) => {
    setCurrentUser(DEMO_USERS[newRole]);
    showToast(`Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}`, 'info');
  };

  // Fetch employees, attendance, and payroll from Backend API
  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Fetch Employees
    try {
      const res = await fetch('http://localhost:3000/api/employees?limit=100', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.items) {
          setEmployees(data.data.items);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch employees, using local fallback:', e);
    }

    // Fetch Payroll
    try {
      const res = await fetch('http://localhost:3000/api/payroll', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setPayroll(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch payroll, using local fallback:', e);
    }

    // Fetch Attendance
    try {
      const res = await fetch('http://localhost:3000/api/attendance', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setAttendance(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch attendance, using local fallback:', e);
    }

    // Fetch Shifts
    try {
      const res = await fetch('http://localhost:3000/api/shifts', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setWorkShifts(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch shifts, using local fallback:', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentUser]);

  // Employee CRUD with Backend Sync
  const addEmployee = async (newEmp: Omit<Employee, 'created_at' | 'updated_at'>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:3000/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_code: newEmp.employee_id,
          full_name: newEmp.full_name,
          email: newEmp.email,
          position: newEmp.position,
          phone: newEmp.phone,
          department: newEmp.department,
          status: newEmp.status,
          base_salary: newEmp.base_salary,
          avatar_url: newEmp.avatar,
        }),
      });

      const resData = await response.json().catch(() => null);

      if (response.ok && resData?.success && resData?.data) {
        const createdEmp: Employee = resData.data;
        setEmployees(prev => [createdEmp, ...prev]);
        showToast(`Đã thêm nhân viên ${createdEmp.full_name} (${createdEmp.employee_id}) vào CSDL`, 'success');
        return;
      } else if (resData) {
        showToast(resData.message || 'Lỗi khi thêm nhân viên vào CSDL', 'error');
        return;
      }
    } catch (e) {
      console.error('Add employee API error:', e);
    }

    // Local fallback ONLY if network is completely unreachable
    const now = new Date().toISOString();
    const created: Employee = {
      ...newEmp,
      created_at: now,
      updated_at: now,
    };
    setEmployees(prev => [created, ...prev]);
    showToast(`Đã thêm nhân viên ${newEmp.full_name} (${newEmp.employee_id}) (Chế độ offline)`, 'warning');
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:3000/api/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: updates.full_name,
          email: updates.email,
          position: updates.position,
          phone: updates.phone,
          department: updates.department,
          status: updates.status,
          base_salary: updates.base_salary,
          avatar_url: updates.avatar,
        }),
      });

      const resData = await response.json().catch(() => null);

      if (response.ok && resData?.success && resData?.data) {
        const updatedEmp: Employee = resData.data;
        setEmployees(prev => prev.map(emp => (emp.employee_id === id || emp.employee_id === updatedEmp.employee_id) ? updatedEmp : emp));
        showToast(`Đã cập nhật thông tin nhân viên ${updatedEmp.full_name} trong CSDL`, 'success');
        return;
      } else if (resData) {
        showToast(resData.message || 'Lỗi khi cập nhật nhân viên', 'error');
        return;
      }
    } catch (e) {
      console.error('Update employee API error:', e);
    }

    // Local fallback ONLY if network is completely unreachable
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
    showToast(`Đã cập nhật thông tin nhân viên ${id} (Chế độ offline)`, 'warning');
  };

  const toggleEmployeeStatus = async (id: string) => {
    const targetEmp = employees.find(e => e.employee_id === id);
    if (!targetEmp) return;
    const nextStatus = targetEmp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateEmployee(id, { status: nextStatus });
  };

  // Shift assignment
  const assignOrUpdateShift = async (shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:3000/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_id: shiftData.employee_id,
          date: shiftData.date,
          shift_type: shiftData.shift_type,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          note: shiftData.note,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          const savedShift: WorkShift = resData.data;
          setWorkShifts(prev => {
            const idx = prev.findIndex(s => s.employee_id === savedShift.employee_id && s.date === savedShift.date);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = savedShift;
              return updated;
            }
            return [...prev, savedShift];
          });
          showToast(`Đã lưu lịch làm việc ngày ${savedShift.date} vào CSDL`, 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Assign shift API error:', e);
    }

    // Local fallback if offline
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
  const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'attendance_id'>) => {
    const token = localStorage.getItem('token');
    const endpoint = record.type === 'CHECK_IN' ? 'check-in' : 'check-out';
    try {
      const response = await fetch(`http://localhost:3000/api/attendance/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employeeId: record.employee_id,
          device_info: record.device_id,
          method: record.method,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          const newRec: AttendanceRecord = resData.data;
          setAttendance(prev => [newRec, ...prev]);
          showToast(`Đã ghi nhận CSDL chấm công: ${record.type}`, 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Attendance API error:', e);
    }

    // Local fallback
    const newRecord: AttendanceRecord = {
      ...record,
      attendance_id: `ATT-${Date.now()}`
    };
    setAttendance(prev => [newRecord, ...prev]);
    showToast(`Đã ghi nhận chấm công: ${record.type}`, 'success');
  };

  // Payroll
  const updatePayrollItem = async (id: string, updates: Partial<PayrollRecord>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:3000/api/payroll/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          base_salary: updates.base_salary,
          allowance: updates.allowance,
          deduction: updates.deduction,
          status: updates.status,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          const updatedRec: PayrollRecord = resData.data;
          setPayroll(prev => prev.map(p => (p.payroll_id === id || p.id === id) ? updatedRec : p));
          showToast('Đã lưu thay đổi phiếu lương vào CSDL', 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Update payroll item API error:', e);
    }

    // Fallback
    setPayroll(prev => prev.map(p => {
      if (p.payroll_id === id || p.id === id) {
        const updated = { ...p, ...updates };
        updated.total_paid = Math.max(0, updated.base_salary + updated.allowance - updated.deduction);
        return updated;
      }
      return p;
    }));
    showToast('Đã lưu thay đổi phiếu lương', 'success');
  };

  const finalizePayrollPeriod = async (period: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:3000/api/payroll/period/${period}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data)) {
          setPayroll(resData.data);
          showToast(`Đã chốt bảng lương kỳ ${period} trong CSDL`, 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Finalize payroll API error:', e);
    }

    // Fallback
    setPayroll(prev => prev.map(p => {
      if (p.period === period) {
        return { ...p, status: 'FINALIZED' };
      }
      return p;
    }));
    showToast(`Đã chốt bảng lương kỳ ${period}`, 'success');
  };

  const unlockPayrollPeriod = async (period: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:3000/api/payroll/period/${period}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data)) {
          setPayroll(resData.data);
          showToast(`Đã mở khoá bảng lương kỳ ${period} trong CSDL`, 'warning');
          return;
        }
      }
    } catch (e) {
      console.error('Unlock payroll API error:', e);
    }

    // Fallback
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
