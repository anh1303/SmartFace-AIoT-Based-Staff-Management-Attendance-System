import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../utils/apiConfig';
import { 
  Employee, 
  WorkShift, 
  AttendanceRecord, 
  PayrollRecord, 
  BonusPenaltyPolicy,
  UserSession, 
  Role, 
  ToastMessage 
} from '../types';

const DEFAULT_USERS: Record<Role, UserSession> = {
  manager: {
    employee_id: 'NV-001',
    full_name: 'Nguyễn Văn A',
    email: 'anv@aiot.corp',
    role: 'manager',
    position: 'AI Engineer Lead',
    department: 'Kỹ thuật AI',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  employee: {
    employee_id: 'NV-002',
    full_name: 'Lê Hoàng Phúc',
    email: 'employee@company.com',
    role: 'employee',
    position: 'DevOps Engineer',
    department: 'Vận hành & IT',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
};

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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('userSession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [bonusPenalty, setBonusPenalty] = useState<BonusPenaltyPolicy | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const role: Role = currentUser?.role || 'employee';

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
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const resData = await response.json();

      if (response.ok && resData.success && resData.data) {
        const { user, accessToken } = resData.data;
        const targetRole: Role = user.role === 'manager' || user.role === 'ADMIN' ? 'manager' : 'employee';
        
        const session: UserSession = {
          employee_id: user.employee_id || user.username || 'EMP-001',
          full_name: user.full_name || user.username,
          email: user.email || '',
          role: targetRole,
          position: user.position || (targetRole === 'manager' ? 'Manager' : 'Employee'),
          department: user.department || 'Chung',
          avatar: user.avatar || (targetRole === 'manager' ? DEFAULT_USERS.manager.avatar : DEFAULT_USERS.employee.avatar),
        };

        setCurrentUser(session);
        localStorage.setItem('userSession', JSON.stringify(session));
        localStorage.setItem('token', accessToken);

        showToast(`Đăng nhập thành công! Vai trò: ${targetRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'success');
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
      const targetServer = API_BASE || 'Backend';
      const errMsg = `Không thể kết nối đến máy chủ Backend (${targetServer}). Vui lòng đảm bảo Backend đang chạy!`;
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
    const matched = employees.find(e =>
      newRole === 'manager'
        ? e.position?.toLowerCase().includes('lead') || e.position?.toLowerCase().includes('manager')
        : !e.position?.toLowerCase().includes('manager'),
    ) || employees[0];

    if (matched) {
      const session: UserSession = {
        employee_id: matched.employee_id,
        full_name: matched.full_name,
        email: matched.email || '',
        role: newRole,
        position: matched.position || (newRole === 'manager' ? 'Manager' : 'Employee'),
        department: matched.department || 'Chung',
        avatar: matched.avatar || '',
      };
      setCurrentUser(session);
      localStorage.setItem('userSession', JSON.stringify(session));
    } else {
      setCurrentUser(DEFAULT_USERS[newRole]);
    }
    showToast(`Đã chuyển đổi sang giao diện: ${newRole === 'manager' ? 'Quản lý (Manager)' : 'Nhân viên (Employee)'}`, 'info');
  };

  // Fetch employees, attendance, and payroll from Backend API
  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`${API_BASE}/api/employees?limit=100`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const mapped: Employee[] = data.data.map((emp: any) => ({
            id: emp.id,
            employee_id: emp.employee_code || emp.employee_id || emp.id,
            full_name: emp.full_name,
            department: emp.department?.name || emp.department || 'Chung',
            position: emp.position || 'Nhân viên',
            phone: emp.phone || '',
            email: emp.email || '',
            status: emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
            created_at: emp.createdAt || emp.created_at || new Date().toISOString(),
            updated_at: emp.updatedAt || emp.updated_at || new Date().toISOString(),
            face_enrolled: Array.isArray(emp.face_embeddings) ? emp.face_embeddings.length > 0 : Boolean(emp.face_enrolled),
            fingerprint_enrolled: Boolean(emp.fingerprint_enrolled),
            avatar: emp.avatar_url || emp.avatar || undefined,
            hourly_rate: emp.hourly_rate ? Number(emp.hourly_rate) : undefined,
          }));
          setEmployees(mapped);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch employees from DB:', e);
    }

    try {
      const res = await fetch(`${API_BASE}/api/payroll`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setPayroll(data.data);
          if (data.data.length > 0 && data.data[0].period) {
            setSelectedPeriod(data.data[0].period);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch payroll from DB:', e);
    }

    try {
      const resBp = await fetch(`${API_BASE}/api/payroll/bonus-penalty`, { headers });
      if (resBp.ok) {
        const dataBp = await resBp.json();
        if (dataBp.success && dataBp.data) {
          setBonusPenalty(dataBp.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch bonus-penalty policy from DB:', e);
    }

    try {
      const res = await fetch(`${API_BASE}/api/attendance`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setAttendance(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch attendance from DB:', e);
    }

    try {
      const res = await fetch(`${API_BASE}/api/shifts`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setWorkShifts(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch shifts from DB:', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const addEmployee = async (newEmp: Omit<Employee, 'created_at' | 'updated_at'>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/employees`, {
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
          department_id: newEmp.department ? 1 : undefined,
          hourly_rate: newEmp.hourly_rate || 0,
        }),
      });
      const resData = await response.json().catch(() => null);
      if (response.ok && resData?.success && resData?.data) {
        showToast(`Đã thêm nhân viên ${newEmp.full_name} vào CSDL thành công`, 'success');
        fetchAllData();
        return;
      }
    } catch (e) {
      console.error('Add employee API error:', e);
    }
    const now = new Date().toISOString();
    const created: Employee = {
      ...newEmp,
      created_at: now,
      updated_at: now,
    };
    setEmployees(prev => [created, ...prev]);
    showToast(`Đã thêm nhân viên ${newEmp.full_name} (${newEmp.employee_id}) (Chế độ local)`, 'info');
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/employees/${id}`, {
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
          hourly_rate: updates.hourly_rate,
          avatar_url: updates.avatar,
        }),
      });
      const resData = await response.json().catch(() => null);
      if (response.ok && resData?.success && resData?.data) {
        setEmployees(prev => prev.map(emp => {
          if (emp.id === id || emp.employee_id === id || emp.employee_id === resData.data.employee_id) {
            return {
              ...emp,
              ...resData.data,
              face_enrolled: updates.face_enrolled !== undefined ? updates.face_enrolled : emp.face_enrolled,
              fingerprint_enrolled: updates.fingerprint_enrolled !== undefined ? updates.fingerprint_enrolled : emp.fingerprint_enrolled,
            };
          }
          return emp;
        }));
        showToast(`Đã cập nhật thông tin nhân viên trong CSDL`, 'success');
        return;
      }
    } catch (e) {
      console.error('Update employee API error:', e);
    }
    setEmployees(prev => prev.map(emp => (emp.employee_id === id || emp.id === id) ? { ...emp, ...updates } : emp));
    showToast(`Đã cập nhật thông tin nhân viên`, 'info');
  };

  const toggleEmployeeStatus = (id: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.employee_id === id || emp.id === id) {
        const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        updateEmployee(id, { status: nextStatus });
        return { ...emp, status: nextStatus };
      }
      return emp;
    }));
  };

  const assignOrUpdateShift = async (shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employeeId: shiftData.employee_id,
          work_date: shiftData.date,
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

    setWorkShifts(prev => {
      const existingIndex = prev.findIndex(s => s.employee_id === shiftData.employee_id && s.date === shiftData.date);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...shiftData, shift_id: updated[existingIndex].shift_id };
        return updated;
      }
      return [...prev, { ...shiftData, shift_id: shiftData.shift_id || `S-${Date.now()}` }];
    });
    showToast(`Đã lưu lịch làm việc cho ${shiftData.date}`, 'info');
  };

  const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'attendance_id'>) => {
    const token = localStorage.getItem('token');
    const endpoint = record.type === 'CHECK_IN' ? 'check-in' : 'check-out';
    try {
      const response = await fetch(`${API_BASE}/api/attendance/${endpoint}`, {
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
        showToast('Điểm danh thành công', 'success');
        fetchAllData();
        return;
      }
    } catch (e) {
      console.error('Attendance API error:', e);
    }
    const newRecord: AttendanceRecord = {
      ...record,
      attendance_id: `ATT-${Date.now()}`,
    };
    setAttendance(prev => [newRecord, ...prev]);
    showToast(`Ghi nhận lượt điểm danh ${record.type} (Local)`, 'info');
  };

  const generatePayroll = async (period: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/payroll/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ period }),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data)) {
          setPayroll(resData.data);
          setSelectedPeriod(period);
          showToast(`Đã tính toán bảng lương kỳ ${period} từ CSDL`, 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Generate payroll API error:', e);
    }
    showToast(`Lỗi khi tính toán bảng lương kỳ ${period}`, 'error');
  };

  const updatePayrollItem = async (id: string, updates: Partial<PayrollRecord>) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/payroll/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          hourly_rate: updates.hourly_rate,
          allowance: updates.allowance,
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
    setPayroll(prev => prev.map(p => {
      if (p.payroll_id === id || p.id === id) {
        const updated = { ...p, ...updates };
        updated.net_salary = Math.max(0, (updated.hourly_rate || 0) * (updated.total_working_hours || 0) + (updated.allowance || 0));
        return updated;
      }
      return p;
    }));
    showToast('Đã lưu thay đổi phiếu lương (Local)', 'info');
  };

  const finalizePayrollPeriod = async (period: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/payroll/period/${period}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        showToast(`Đã chốt bảng lương kỳ ${period} trong CSDL`, 'success');
        fetchAllData();
        return;
      }
    } catch (e) {
      console.error('Finalize payroll API error:', e);
    }
    setPayroll(prev => prev.map(p => p.period === period ? { ...p, status: 'FINALIZED' } : p));
    showToast(`Đã chốt bảng lương kỳ ${period}`, 'info');
  };

  const unlockPayrollPeriod = async (period: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/payroll/period/${period}/unlock`, {
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
    setPayroll(prev => prev.map(p => p.period === period ? { ...p, status: 'PENDING' } : p));
    showToast(`Đã mở khoá chỉnh sửa bảng lương kỳ ${period}`, 'info');
  };

  const updateBonusPenalty = async (data: { overtime_rate?: number; late_early_penalty?: number; description?: string }) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/payroll/bonus-penalty`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          setBonusPenalty(resData.data);
          showToast('Cập nhật chính sách thưởng/phạt vào CSDL thành công', 'success');
          return;
        }
      }
    } catch (e) {
      console.error('Update bonus penalty API error:', e);
    }
    setBonusPenalty(prev => ({
      id: prev?.id || 1,
      overtime_rate: data.overtime_rate !== undefined ? data.overtime_rate : (prev?.overtime_rate || 1.5),
      late_early_penalty: data.late_early_penalty !== undefined ? data.late_early_penalty : (prev?.late_early_penalty || 50000),
      description: data.description !== undefined ? data.description : (prev?.description || ''),
    }));
    showToast('Đã lưu thay đổi chính sách thưởng/phạt (Local)', 'info');
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
        bonusPenalty,
        selectedPeriod,
        setSelectedPeriod,
        generatePayroll,
        updatePayrollItem,
        finalizePayrollPeriod,
        unlockPayrollPeriod,
        updateBonusPenalty,
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