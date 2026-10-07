import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  User,
  Users,
  Search,
  Filter,
  Calendar,
  Clock,
  DollarSign,
  ScanFace,
  Fingerprint,
  Mail,
  Phone,
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Edit,
  Eye,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  CreditCard,
  Sparkles,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  CalendarRange,
  BadgeCheck,
  Zap,
  Activity,
  History
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Employee, AttendanceRecord, PayrollRecord, WorkShift } from '../../types';
import {
  formatVNDate,
  formatVNTime,
  formatVNDatetime,
  formatVNDateISO,
  getTodayVNString
} from '../../utils/dateUtils';

export const ManagerEmployeeDetail: React.FC = () => {
  const {
    employees,
    updateEmployee,
    attendance,
    payroll,
    bonusPenalty,
    workShifts,
    showToast
  } = useApp();

  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get selected employee ID from route params, query string, or default to first employee
  const urlEmployeeId = params.id || searchParams.get('id') || searchParams.get('employee_id');

  const [selectedEmpCode, setSelectedEmpCode] = useState<string>(() => {
    if (urlEmployeeId) {
      const match = employees.find(
        e => e.employee_id === urlEmployeeId || e.id === urlEmployeeId
      );
      if (match) return match.employee_id;
    }
    return employees[0]?.employee_id || 'NV-001';
  });

  // Keep state synced with URL or employees list
  useEffect(() => {
    if (urlEmployeeId) {
      const match = employees.find(
        e => e.employee_id === urlEmployeeId || e.id === urlEmployeeId
      );
      if (match && match.employee_id !== selectedEmpCode) {
        setSelectedEmpCode(match.employee_id);
      }
    } else if (employees.length > 0 && !employees.some(e => e.employee_id === selectedEmpCode)) {
      setSelectedEmpCode(employees[0].employee_id);
    }
  }, [urlEmployeeId, employees, selectedEmpCode]);

  // Current selected employee object
  const currentEmp = useMemo(() => {
    return (
      employees.find(e => e.employee_id === selectedEmpCode || e.id === selectedEmpCode) ||
      employees[0] ||
      null
    );
  }, [employees, selectedEmpCode]);

  // Employee switcher filter & dropdown search
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const filteredEmployeeList = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      e =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.includes(q)
    );
  }, [employees, employeeSearchQuery]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmpCode(emp.employee_id);
    setSearchParams({ id: emp.employee_id });
    setIsEmployeeDropdownOpen(false);
    setEmployeeSearchQuery('');
  };

  const handlePrevEmployee = () => {
    if (employees.length === 0) return;
    const currentIndex = employees.findIndex(e => e.employee_id === currentEmp?.employee_id);
    const prevIndex = (currentIndex - 1 + employees.length) % employees.length;
    handleSelectEmployee(employees[prevIndex]);
  };

  const handleNextEmployee = () => {
    if (employees.length === 0) return;
    const currentIndex = employees.findIndex(e => e.employee_id === currentEmp?.employee_id);
    const nextIndex = (currentIndex + 1) % employees.length;
    handleSelectEmployee(employees[nextIndex]);
  };

  // ==========================
  // 1. DATE RANGE FOR ATTENDANCE
  // ==========================
  const todayVN = getTodayVNString();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const startOfCurrentMonth = `${currentYear}-${currentMonth}-01`;

  const [startDate, setStartDate] = useState<string>(() => startOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(() => todayVN);
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState<string>('ALL');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'payroll' | 'schedule'>('overview');

  // Quick Date Range Preset helper
  const setQuickRange = (preset: 'today' | '7days' | 'month' | 'lastmonth') => {
    const today = new Date();
    if (preset === 'today') {
      const d = getTodayVNString();
      setStartDate(d);
      setEndDate(d);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setStartDate(formatVNDateISO(past));
      setEndDate(getTodayVNString());
    } else if (preset === 'month') {
      setStartDate(startOfCurrentMonth);
      setEndDate(getTodayVNString());
    } else if (preset === 'lastmonth') {
      const prevM = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevM = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatVNDateISO(prevM));
      setEndDate(formatVNDateISO(lastDayPrevM));
    }
  };

  // ==========================
  // 2. ATTENDANCE DATA & STATS
  // ==========================
  const employeeAttendanceLogs = useMemo(() => {
    if (!currentEmp) return [];
    return attendance
      .filter(record => {
        if (record.employee_id !== currentEmp.employee_id && record.employee_id !== currentEmp.id) {
          return false;
        }
        const recordDate = formatVNDateISO(record.timestamp);
        if (startDate && recordDate < startDate) return false;
        if (endDate && recordDate > endDate) return false;
        if (attendanceTypeFilter !== 'ALL' && record.type !== attendanceTypeFilter) return false;
        if (attendanceStatusFilter === 'ON_TIME' && record.punctuality !== 'ON_TIME') return false;
        if (attendanceStatusFilter === 'LATE' && record.punctuality !== 'LATE') return false;
        if (attendanceStatusFilter === 'EARLY_LEAVE' && record.punctuality !== 'EARLY_LEAVE') return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendance, currentEmp, startDate, endDate, attendanceTypeFilter, attendanceStatusFilter]);

  // Overall attendance statistics in range
  const attendanceStats = useMemo(() => {
    if (!currentEmp) {
      return { totalLogs: 0, checkIns: 0, checkOuts: 0, workDays: 0, lateCount: 0, earlyLeaveCount: 0, avgConfidence: 0 };
    }
    const empLogs = attendance.filter(r => {
      if (r.employee_id !== currentEmp.employee_id && r.employee_id !== currentEmp.id) return false;
      const rDate = formatVNDateISO(r.timestamp);
      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;
      return true;
    });

    const checkIns = empLogs.filter(r => r.type === 'CHECK_IN').length;
    const checkOuts = empLogs.filter(r => r.type === 'CHECK_OUT' || r.type === 'TAN_CA').length;
    const distinctDays = new Set(empLogs.map(r => formatVNDateISO(r.timestamp))).size;
    const lateCount = empLogs.filter(r => r.punctuality === 'LATE').length;
    const earlyLeaveCount = empLogs.filter(r => r.punctuality === 'EARLY_LEAVE').length;

    const scores = empLogs.map(r => Number(r.verification_score || 0.98)).filter(s => s > 0);
    const avgConfidence = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 98.5;

    return {
      totalLogs: empLogs.length,
      checkIns,
      checkOuts,
      workDays: distinctDays,
      lateCount,
      earlyLeaveCount,
      avgConfidence: Math.round(avgConfidence * 10) / 10
    };
  }, [attendance, currentEmp, startDate, endDate]);

  // ==========================
  // 3. SALARY & PAYROLL DATA
  // ==========================
  const employeePayrolls = useMemo(() => {
    if (!currentEmp) return [];
    return payroll
      .filter(p => p.employee_id === currentEmp.employee_id || p.employee_id === currentEmp.id)
      .sort((a, b) => {
        const periodA = a.period || a.payroll_period || '';
        const periodB = b.period || b.payroll_period || '';
        return periodB.localeCompare(periodA);
      });
  }, [payroll, currentEmp]);

  // Current month estimated payroll calculation
  const currentPeriodKey = `${currentYear}-${currentMonth}`;
  const currentMonthPayroll = useMemo(() => {
    return employeePayrolls.find(p => (p.period || p.payroll_period) === currentPeriodKey) || employeePayrolls[0] || null;
  }, [employeePayrolls, currentPeriodKey]);

  const hourlyRate = currentEmp?.hourly_rate || currentMonthPayroll?.hourly_rate || 100000;
  const standardHours = currentMonthPayroll?.total_working_hours ?? currentMonthPayroll?.working_hours ?? (attendanceStats.workDays * 8 || 160);
  const overtimeHours = currentMonthPayroll?.total_overtime ?? 4.0;
  const lateEarlyHours = currentMonthPayroll?.total_late_early ?? (attendanceStats.lateCount * 0.5);
  const allowance = currentMonthPayroll?.allowance ?? 2000000;

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const penaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const otAmount = otRate <= 10
    ? overtimeHours * hourlyRate * otRate
    : overtimeHours * otRate;

  const penaltyAmount = penaltyRate <= 10
    ? lateEarlyHours * hourlyRate * penaltyRate
    : lateEarlyHours * penaltyRate;

  const baseSalary = standardHours * hourlyRate;
  const currentNetSalary = currentMonthPayroll?.net_salary
    ? Number(currentMonthPayroll.net_salary)
    : Math.max(0, Math.round(baseSalary + otAmount - penaltyAmount + allowance));

  // Past months payroll history (excluding current period or showing all periods)
  const pastPayrolls = useMemo(() => {
    return employeePayrolls;
  }, [employeePayrolls]);

  // Shifts of this employee
  const employeeShifts = useMemo(() => {
    if (!currentEmp) return [];
    return workShifts
      .filter(s => s.employee_id === currentEmp.employee_id || s.employee_id === currentEmp.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workShifts, currentEmp]);

  // ==========================
  // 4. MODAL STATES
  // ==========================
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPayslipModal, setSelectedPayslipModal] = useState<PayrollRecord | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: '',
    position: '',
    phone: '',
    email: '',
    hourly_rate: 100000,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    avatar: '',
  });

  const handleOpenEditModal = () => {
    if (!currentEmp) return;
    setEditForm({
      full_name: currentEmp.full_name,
      department: currentEmp.department || 'Nhân viên',
      position: currentEmp.position || 'Nhân sự',
      phone: currentEmp.phone || '',
      email: currentEmp.email || '',
      hourly_rate: currentEmp.hourly_rate || 100000,
      status: currentEmp.status,
      avatar: currentEmp.avatar || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) return;
    try {
      await updateEmployee(currentEmp.id || currentEmp.employee_id, {
        full_name: editForm.full_name,
        department: editForm.department,
        position: editForm.position,
        phone: editForm.phone,
        email: editForm.email,
        hourly_rate: Number(editForm.hourly_rate),
        status: editForm.status,
        avatar: editForm.avatar,
      });
      showToast(`Đã cập nhật thông tin nhân viên ${editForm.full_name} thành công`, 'success');
      setEditModalOpen(false);
    } catch {
      showToast('Có lỗi xảy ra khi cập nhật thông tin nhân viên', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!currentEmp) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl shadow-xs">
        <Users className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chưa có dữ liệu nhân viên</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vui lòng thêm nhân viên mới vào hệ thống.</p>
        <button
          onClick={() => navigate('/app/manager/employees')}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-purple-600/20 cursor-pointer"
        >
          Đến trang danh sách nhân viên
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & EMPLOYEE SWITCHER BAR */}
      {/* ========================================================================= */}
      <div className="bento-hero-gradient rounded-2xl p-5 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Page Title & Breadcrumb */}
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/app/manager/employees')}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
                title="Quay lại danh sách nhân viên"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight flex items-center gap-2">
                Hồ Sơ Chi Tiết Nhân Viên
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50">
                  {currentEmp.employee_id}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-8">
              Quản lý toàn diện thông tin cá nhân, định danh sinh trắc học AI, tính toán lương & giám sát chấm công theo thời gian thực.
            </p>
          </div>

          {/* Right: Employee Selector & Quick Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Prev / Next Buttons */}
            <div className="flex items-center bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={handlePrevEmployee}
                title="Nhân viên trước"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Dropdown Employee Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all text-left cursor-pointer"
                >
                  <img
                    src={currentEmp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                    alt={currentEmp.full_name}
                    className="w-7 h-7 rounded-full object-cover border border-purple-300 dark:border-purple-500/40"
                  />
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">
                      {currentEmp.full_name}
                    </p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                      {currentEmp.employee_id}
                    </p>
                  </div>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1" />
                </button>

                {/* Dropdown Search Menu */}
                {isEmployeeDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsEmployeeDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#21264b] rounded-xl shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 border-b border-slate-100 dark:border-[#21264b]">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={employeeSearchQuery}
                            onChange={e => setEmployeeSearchQuery(e.target.value)}
                            placeholder="Tìm tên, mã NV, phòng ban..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1d2243] p-1">
                        {filteredEmployeeList.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                            Không tìm thấy nhân viên
                          </div>
                        ) : (
                          filteredEmployeeList.map(emp => (
                            <button
                              key={emp.employee_id}
                              type="button"
                              onClick={() => handleSelectEmployee(emp)}
                              className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors cursor-pointer ${emp.employee_id === currentEmp.employee_id
                                  ? 'bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50'
                                  : 'hover:bg-slate-50 dark:hover:bg-[#1a1e3a]'
                                }`}
                            >
                              <img
                                src={emp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                                alt={emp.full_name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {emp.full_name}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {emp.employee_id} • {emp.position}
                                </p>
                              </div>
                              {emp.status === 'ACTIVE' ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextEmployee}
                title="Nhân viên tiếp theo"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Actions: Edit & Biometrics & Print */}
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-sm shadow-purple-600/20 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Sửa hồ sơ</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="In hồ sơ nhân viên"
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-[#21264b] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
              }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Tổng quan & Sinh trắc</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'attendance'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
              }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Nhật ký Chấm công ({attendanceStats.totalLogs})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'payroll'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
              }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Lương & Phiếu lương</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'schedule'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
              }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Lịch làm việc ({employeeShifts.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: OVERVIEW & BIOMETRICS (MATCHING USER TABLE SPECIFICATION) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Block: Thông tin nhân sự (Trái) & Sinh trắc học (Phải) */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* CỘT TRÁI: THÔNG TIN CÁ NHÂN & CÔNG VIỆC (7 Cột) */}
            <div className="lg:col-span-7 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between transition-colors">
              <div className="divide-y divide-slate-100 dark:divide-[#21264b]">
                {/* Hàng 1: Ảnh & Tên nhân viên */}
                <div className="p-5 bg-gradient-to-r from-purple-50/60 to-indigo-50/40 dark:from-[#15193b]/70 dark:to-[#11142e]/70 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={currentEmp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200"}
                        alt={currentEmp.full_name}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-purple-200 dark:border-purple-800 shadow-sm"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#13162b] ${currentEmp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                          }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-heading">
                          {currentEmp.full_name}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${currentEmp.status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          {currentEmp.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Hồ sơ nhân sự • Hệ thống AIoT SmartFace
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sửa</span>
                  </button>
                </div>

                {/* Hàng 2: Mã Nhân Viên & Chức vụ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mã Nhân Viên:</span>
                    <p className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400">{currentEmp.employee_id}</p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Chức vụ:</span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {currentEmp.position || 'Nhân viên'}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                        ({currentEmp.department || 'Chung'})
                      </span>
                    </p>
                  </div>
                </div>

                {/* Hàng 3: Email & Số điện thoại */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Email:</span>
                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">{currentEmp.email || 'Chưa cập nhật'}</p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Số điện thoại:</span>
                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200">{currentEmp.phone || 'Chưa cập nhật'}</p>
                  </div>
                </div>

                {/* Hàng 4: Lương theo giờ & Ngày tham gia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Lương theo giờ:</span>
                    <p className="text-sm font-mono font-extrabold text-purple-600 dark:text-purple-400">
                      {hourlyRate.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">đ</span>
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Ngày tham gia:</span>
                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200">{formatVNDate(currentEmp.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: SINH TRẮC HỌC (5 Cột) */}
            <div className="lg:col-span-5 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between transition-colors">
              <div className="divide-y divide-slate-100 dark:divide-[#21264b]">
                {/* Hàng 1: Header Sinh trắc học */}
                <div className="p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-700/50">
                      <ScanFace className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                      Sinh trắc học
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50">
                    PGVECTOR AI
                  </span>
                </div>

                {/* Hàng 2: Nhận diện khuôn mặt (Face ID) */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScanFace className={`w-4 h-4 ${currentEmp.face_enrolled ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Nhận diện khuôn mặt (Face ID)</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${currentEmp.face_enrolled
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                        }`}
                    >
                      {currentEmp.face_enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/app/manager/biometrics?employee_id=${currentEmp.employee_id}`)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${currentEmp.face_enrolled
                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a]'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20'
                      }`}
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    <span>{currentEmp.face_enrolled ? 'Chỉnh sửa (đã đk)' : 'Đăng ký (chưa đk)'}</span>
                  </button>
                </div>

                {/* Hàng 3: Cảm biến vân tay (FAP30) */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fingerprint className={`w-4 h-4 ${currentEmp.fingerprint_enrolled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Cảm biến vân tay (FAP30)</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${currentEmp.fingerprint_enrolled
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      {currentEmp.fingerprint_enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/app/manager/biometrics?employee_id=${currentEmp.employee_id}&tab=fingerprint`)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${currentEmp.fingerprint_enrolled
                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a]'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20'
                      }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>{currentEmp.fingerprint_enrolled ? 'Chỉnh sửa (đã đk)' : 'Đăng ký (chưa đk)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI DƯỚI: ĐÁNH GIÁ CHUNG (TRUNG BÌNH TRÊN MỘT THÁNG) - 4 CỘT */}
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
            {/* Tiêu đề bảng */}
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading">
                  Đánh giá chung (trung bình trên một tháng)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tổng hợp số ngày công, giờ tăng ca, thời gian đi trễ/về sớm và mức lương thực nhận
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-[#0f1224] px-3 py-1.5 rounded-xl border border-purple-200 dark:border-[#272d5a] self-start sm:self-auto">
                <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Kỳ: {currentPeriodKey}</span>
              </div>
            </div>

            {/* Bảng 4 Cột cân đối */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
              {/* Cột 1: Số ngày đi làm */}
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Số ngày đi làm</span>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {attendanceStats.workDays} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">ngày</span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {attendanceStats.workDays} / 22 ngày công chuẩn
                </p>
              </div>

              {/* Cột 2: Thời gian tăng ca */}
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thời gian tăng ca</span>
                <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  +{overtimeHours} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">giờ</span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Thưởng OT: +{otAmount.toLocaleString('vi-VN')} ₫
                </p>
              </div>

              {/* Cột 3: Thời gian đi trễ/về sớm */}
              <div className="p-5 space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thời gian đi trễ/về sớm</span>
                <p className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
                  {lateEarlyHours} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">giờ</span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Vi phạm: {attendanceStats.lateCount + attendanceStats.earlyLeaveCount} lần
                </p>
              </div>

              {/* Cột 4: Mức lương thực nhận */}
              <div className="p-5 space-y-1.5 bg-purple-50/30 dark:bg-[#0f1224]/50">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mức lương thực nhận</span>
                <p className="text-2xl font-extrabold font-mono text-purple-600 dark:text-purple-400">
                  {currentNetSalary.toLocaleString('vi-VN')} <span className="text-base text-slate-500 dark:text-slate-400 font-normal">₫</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Thu nhập thực nhận kỳ này
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB 2: ATTENDANCE & CHECK-IN / CHECK-OUT LOGS (FROM DATE TO DATE) */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Bento Filter Header Bar */}
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Nhật Ký Chấm Công Check-in / Check-out
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lọc và kiểm tra thời gian vào/ra, điểm tin cậy AI và trạng thái đi muộn / về sớm của nhân viên.
                </p>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickRange('today')}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('7days')}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
                >
                  7 ngày qua
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('month')}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 text-xs font-mono font-semibold cursor-pointer"
                >
                  Tháng này
                </button>
                <button
                  type="button"
                  onClick={() => setQuickRange('lastmonth')}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
                >
                  Tháng trước
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-[#21264b]">
              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Từ ngày (Start Date)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Đến ngày (End Date)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Event Type Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Loại sự kiện
                </label>
                <select
                  value={attendanceTypeFilter}
                  onChange={e => setAttendanceTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả sự kiện</option>
                  <option value="CHECK_IN">Chỉ Check-in (Vào ca)</option>
                  <option value="CHECK_OUT">Chỉ Check-out (Tan ca)</option>
                </select>
              </div>

              {/* Punctuality Status Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Trạng thái tuân thủ
                </label>
                <select
                  value={attendanceStatusFilter}
                  onChange={e => setAttendanceStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ON_TIME">Đúng giờ (On-time)</option>
                  <option value="LATE">Đi muộn (Late)</option>
                  <option value="EARLY_LEAVE">Về sớm (Early leave)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4 Stats Cards in Date Range */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-1 transition-colors">
              <span className="text-xs text-slate-500 dark:text-slate-400">Tổng lượt quẹt thẻ</span>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{attendanceStats.totalLogs}</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {attendanceStats.checkIns} Vào • {attendanceStats.checkOuts} Ra
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-1 transition-colors">
              <span className="text-xs text-slate-500 dark:text-slate-400">Số ngày có mặt</span>
              <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">{attendanceStats.workDays} ngày</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Tính theo ngày khác nhau
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-1 transition-colors">
              <span className="text-xs text-slate-500 dark:text-slate-400">Đi muộn / Về sớm</span>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {attendanceStats.lateCount + attendanceStats.earlyLeaveCount} lần
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {attendanceStats.lateCount} Muộn • {attendanceStats.earlyLeaveCount} Sớm
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-1 transition-colors">
              <span className="text-xs text-slate-500 dark:text-slate-400">Độ tin cậy AI trung bình</span>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{attendanceStats.avgConfidence}%</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Nhận diện FaceCam AIoT
              </span>
            </div>
          </div>

          {/* Attendance Log Table */}
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
            <div className="p-4 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Bản ghi chấm công ({employeeAttendanceLogs.length} kết quả)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Khoảng ngày: {startDate ? formatVNDate(startDate) : '--'} đến {endDate ? formatVNDate(endDate) : '--'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-100 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-medium">Thời gian</th>
                    <th className="py-3.5 px-4 font-medium">Loại sự kiện</th>
                    <th className="py-3.5 px-4 font-medium">Phương thức</th>
                    <th className="py-3.5 px-4 font-medium">Thiết bị AIoT</th>
                    <th className="py-3.5 px-4 font-medium">Điểm AI</th>
                    <th className="py-3.5 px-4 font-medium">Tuân thủ giờ</th>
                    <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
                  {employeeAttendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        Không có bản ghi chấm công nào trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    employeeAttendanceLogs.map((log, index) => {
                      const isCheckIn = log.type === 'CHECK_IN';
                      const score = Number(log.verification_score || 0.98);
                      const isFace = log.method === 'FACE' || !log.method;

                      return (
                        <tr key={log.attendance_id || log.id || index} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 font-mono">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {formatVNTime(log.timestamp, true)}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {formatVNDate(log.timestamp)}
                            </p>
                          </td>

                          {/* Event Type */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${isCheckIn
                                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50'
                                }`}
                            >
                              <Clock className="w-3 h-3" />
                              {isCheckIn ? 'VÀO CA (IN)' : 'TAN CA (OUT)'}
                            </span>
                          </td>

                          {/* Method */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {isFace ? (
                                <ScanFace className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              ) : log.method === 'FINGERPRINT' ? (
                                <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <User className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                                {isFace ? 'Face ID AI' : log.method === 'FINGERPRINT' ? 'Vân tay' : 'Thủ công'}
                              </span>
                            </div>
                          </td>

                          {/* Device */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {log.device_id || 'FaceCam-01 (Cổng)'}
                          </td>

                          {/* AI Verification Score */}
                          <td className="py-3.5 px-4 font-mono">
                            <span
                              className={`font-bold ${score >= 0.9
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : score >= 0.75
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                              {(score * 100).toFixed(1)}%
                            </span>
                          </td>

                          {/* Punctuality */}
                          <td className="py-3.5 px-4">
                            {log.punctuality === 'LATE' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                Đi muộn
                              </span>
                            ) : log.punctuality === 'EARLY_LEAVE' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                                Về sớm
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                Đúng giờ
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {log.status === 'VALID' ? 'HỢP LỆ' : log.status || 'HỢP LỆ'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 3: SALARY DETAILS & PAST MONTHS PAYROLLS */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Bento Current Month Breakdown Card */}
          <div className="p-8 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-6 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading">
                    Lương Tạm Tính (Kỳ {currentPeriodKey})
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-mono font-bold border border-amber-200 dark:border-amber-800/50">
                    {currentMonthPayroll?.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'ĐANG TÍCH LŨY'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tính toán minh bạch từ lương theo giờ ({hourlyRate.toLocaleString('vi-VN')} ₫/h), giờ làm thực tế, thưởng OT và phụ cấp.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-[#0f1224] border border-purple-200 dark:border-[#272d5a] text-purple-600 dark:text-purple-400 text-xs font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>CSDL ĐÃ ĐỒNG BỘ</span>
              </div>
            </div>

            {/* Main Metric Banner */}
            <div className="grid md:grid-cols-12 gap-6 items-center p-6 bg-slate-50 dark:bg-[#0f1224] rounded-xl border border-slate-200/80 dark:border-[#21264b]">
              <div className="md:col-span-7 space-y-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ước tính thực lĩnh tháng này (Net Salary)
                </span>
                <div className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {currentNetSalary.toLocaleString('vi-VN')} <span className="text-2xl text-purple-600 dark:text-purple-400 font-normal">₫</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lương cơ bản: <strong className="text-slate-800 dark:text-slate-200">{baseSalary.toLocaleString('vi-VN')} ₫</strong> ({standardHours}h) • Thưởng OT: <strong className="text-emerald-600 dark:text-emerald-400">+{otAmount.toLocaleString('vi-VN')} ₫</strong> • Phụ cấp: <strong className="text-purple-600 dark:text-purple-400">+{allowance.toLocaleString('vi-VN')} ₫</strong>.
                </p>
              </div>

              <div className="md:col-span-5 bg-white dark:bg-[#13162b] p-4 rounded-xl border border-slate-200/80 dark:border-[#21264b] space-y-2.5 shadow-xs">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Tiến độ tích lũy ngày công</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                    {attendanceStats.workDays} / 22 ngày ({Math.min(100, Math.round((attendanceStats.workDays / 22) * 100))}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-[#0f1224] h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-[#272d5a]">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round((attendanceStats.workDays / 22) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Hệ số OT: {otRate}x</span>
                  <span>Đơn giá phạt: {penaltyRate <= 10 ? `${penaltyRate}x` : `${penaltyRate.toLocaleString('vi-VN')} ₫/h`}</span>
                </div>
              </div>
            </div>

            {/* Income Breakdown Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Các khoản thu nhập cộng (+)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-[#21264b]">
                    <span className="text-slate-500 dark:text-slate-400">Lương giờ định mức ({standardHours}h):</span>
                    <span className="font-mono text-slate-900 dark:text-white font-bold">{baseSalary.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-[#21264b]">
                    <span className="text-slate-500 dark:text-slate-400">Thưởng tăng ca ({overtimeHours}h OT):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{otAmount.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Phụ cấp trách nhiệm:</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">+{allowance.toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Khấu trừ & Phạt vi phạm (-)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-[#21264b]">
                    <span className="text-slate-500 dark:text-slate-400">Phạt đi muộn / về sớm ({lateEarlyHours}h):</span>
                    <span className={`font-mono font-bold ${penaltyAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                      {penaltyAmount > 0 ? `-${penaltyAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-[#21264b]">
                    <span className="text-slate-500 dark:text-slate-400">Thuế TNCN tạm tính:</span>
                    <span className="font-mono text-slate-400 font-bold">0 ₫</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Bảo hiểm xã hội:</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">Trừ theo quy chế công ty</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Past Months Payroll Records Table */}
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
            <div className="p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Lịch Sử Phiếu Lương Các Tháng Trước
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Danh sách các kỳ lương đã được lập cho nhân viên</p>
              </div>

              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {pastPayrolls.length} kỳ lương
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-100 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-medium">Kỳ lương</th>
                    <th className="py-3.5 px-4 font-medium">Lương/giờ</th>
                    <th className="py-3.5 px-4 font-medium">Giờ làm</th>
                    <th className="py-3.5 px-4 font-medium">Tăng ca (OT)</th>
                    <th className="py-3.5 px-4 font-medium">Phụ cấp</th>
                    <th className="py-3.5 px-4 font-medium">Thực lĩnh (Net)</th>
                    <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
                  {pastPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        Chưa có lịch sử bảng lương cho nhân viên này.
                      </td>
                    </tr>
                  ) : (
                    pastPayrolls.map((p, idx) => {
                      const hourly = Number(p.hourly_rate || hourlyRate);
                      const working = Number(p.total_working_hours ?? p.working_hours ?? 160);
                      const ot = Number(p.total_overtime ?? 0);
                      const allw = Number(p.allowance ?? 0);
                      const net = Number(p.net_salary ?? 0);

                      return (
                        <tr key={p.payroll_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {p.period || p.payroll_period}
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {hourly.toLocaleString('vi-VN')} ₫/h
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {working}h
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400">
                            +{ot}h
                          </td>
                          <td className="py-3.5 px-4 font-mono text-purple-600 dark:text-purple-400">
                            +{allw.toLocaleString('vi-VN')} ₫
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                            {net.toLocaleString('vi-VN')} ₫
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${p.status === 'FINALIZED'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                                }`}
                            >
                              {p.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'CHỜ DUYỆT'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedPayslipModal(p)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors shadow-sm shadow-purple-600/20 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem phiếu</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 4: WORK SCHEDULES */}
      {/* ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Lịch Phân Ca Làm Việc
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Danh sách các ca làm việc được phân công cho {currentEmp.full_name}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/app/manager/schedule?employee_id=${currentEmp.employee_id}`)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 self-start shadow-sm shadow-purple-600/20 cursor-pointer"
            >
              <CalendarRange className="w-4 h-4" />
              <span>Mở giao diện xếp ca</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-100 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 font-medium">Ngày làm việc</th>
                    <th className="py-3.5 px-4 font-medium">Ca làm việc</th>
                    <th className="py-3.5 px-4 font-medium">Khung giờ</th>
                    <th className="py-3.5 px-4 font-medium">Ghi chú</th>
                    <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
                  {employeeShifts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        Chưa có ca làm việc nào được phân công.
                      </td>
                    </tr>
                  ) : (
                    employeeShifts.map((shift, idx) => (
                      <tr key={shift.shift_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {formatVNDate(shift.date)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {shift.shift_type === 'MORNING'
                            ? 'Ca sáng'
                            : shift.shift_type === 'AFTERNOON'
                              ? 'Ca chiều'
                              : shift.shift_type === 'OFF'
                                ? 'Nghỉ phép'
                                : 'Hành chính'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-purple-600 dark:text-purple-400 font-semibold">
                          {shift.start_time} – {shift.end_time}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                          {shift.note || 'Theo quy chuẩn ca'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${shift.shift_type === 'OFF'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                              }`}
                          >
                            {shift.shift_type === 'OFF' ? 'NGHỈ' : 'ĐÃ PHÂN CA'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL EDIT EMPLOYEE */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Chỉnh sửa hồ sơ - ${currentEmp.full_name}`}
        subtitle={`Mã nhân viên: ${currentEmp.employee_id}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Họ và tên</label>
              <input
                type="text"
                required
                value={editForm.full_name}
                onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mức lương theo giờ (VNĐ/h)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={editForm.hourly_rate}
                onChange={e => setEditForm(prev => ({ ...prev, hourly_rate: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
              <input
                type="text"
                value={editForm.position}
                onChange={e => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phòng ban</label>
              <input
                type="text"
                value={editForm.department}
                onChange={e => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Trạng thái hoạt động</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">URL Ảnh đại diện</label>
              <input
                type="url"
                value={editForm.avatar}
                onChange={e => setEditForm(prev => ({ ...prev, avatar: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shadow-purple-600/20 cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. MODAL PAYSLIP VIEWER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(selectedPayslipModal)}
        onClose={() => setSelectedPayslipModal(null)}
        title={`Phiếu Lương Chi Tiết - Kỳ ${selectedPayslipModal?.period || selectedPayslipModal?.payroll_period}`}
        subtitle="Hệ thống tự động tính lương theo CSDL chuẩn AIoT"
        maxWidth="lg"
      >
        {selectedPayslipModal && (() => {
          const slipHourly = Number(selectedPayslipModal.hourly_rate || hourlyRate);
          const slipWorking = Number(selectedPayslipModal.total_working_hours ?? selectedPayslipModal.working_hours ?? 160);
          const slipOT = Number(selectedPayslipModal.total_overtime ?? 0);
          const slipLate = Number(selectedPayslipModal.total_late_early ?? 0);
          const slipOTAmount = otRate <= 10 ? slipOT * slipHourly * otRate : slipOT * otRate;
          const slipLateAmount = penaltyRate <= 10 ? slipLate * slipHourly * penaltyRate : slipLate * penaltyRate;
          const slipAllowance = Number(selectedPayslipModal.allowance ?? 0);
          const slipBase = slipWorking * slipHourly;

          return (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {currentEmp.full_name} ({currentEmp.employee_id})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentEmp.department} • {currentEmp.position}
                  </p>
                </div>
                <span
                  className={`text-xs font-mono px-3 py-1 rounded-lg border font-medium ${selectedPayslipModal.status === 'FINALIZED'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50'
                    }`}
                >
                  {selectedPayslipModal.status === 'FINALIZED' ? 'ĐÃ CHỐT CHI TRẢ' : 'CHỜ DUYỆT'}
                </span>
              </div>

              {/* Payslip Lines */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Lương theo giờ (Hourly Rate):</span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {slipHourly.toLocaleString('vi-VN')} ₫/h
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Lương cơ bản ({slipWorking} giờ làm):</span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {slipBase.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Thưởng tăng ca ({slipOT}h OT):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    +{slipOTAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Phạt trễ/sớm ({slipLate}h):</span>
                  <span className={`font-mono font-semibold ${slipLateAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {slipLateAmount > 0 ? `-${slipLateAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Phụ cấp chức vụ (Allowance):</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                    +{slipAllowance.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-3 border-t border-slate-100 dark:border-[#21264b] text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">THỰC LĨNH (NET SALARY):</span>
                  <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-base">
                    {Number(selectedPayslipModal.net_salary ?? 0).toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Số tài khoản và tiền lương tự động được chuyển khoản định kỳ.</span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#21264b]">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In phiếu lương</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslipModal(null)}
                  className="px-4 py-2 rounded-xl text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors shadow-sm shadow-purple-600/20 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
