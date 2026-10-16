import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Users, ShieldAlert, Lock } from 'lucide-react';
import { Employee, PayrollRecord } from '../../types';
import { isAnotherManager } from '../../utils/permissionUtils';
import {
  formatVNDateISO,
  getTodayVNString
} from '../../utils/dateUtils';
import {
  EmployeeDetailHeader,
  EmployeeOverviewTab,
  EmployeeAttendanceTab,
  EmployeePayrollTab,
  EmployeeScheduleTab,
  EmployeeAccountTab,
  EmployeeEditModal,
  EmployeePayslipModal,
  EmployeeEditFormData
} from '../../features/employee-detail';

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

  const { currentUser } = useAuth();
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
    // Prefer selecting an employee that this user is allowed to view
    const allowed = employees.find(e => !isAnotherManager(e, currentUser));
    return allowed?.employee_id || employees[0]?.employee_id || 'NV-001';
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
      const allowed = employees.find(e => !isAnotherManager(e, currentUser));
      setSelectedEmpCode(allowed?.employee_id || employees[0].employee_id);
    }
  }, [urlEmployeeId, employees, selectedEmpCode, currentUser]);

  // Current selected employee object
  const currentEmp = useMemo(() => {
    return (
      employees.find(e => e.employee_id === selectedEmpCode || e.id === selectedEmpCode) ||
      employees[0] ||
      null
    );
  }, [employees, selectedEmpCode]);

  const handleSelectEmployee = (emp: Employee) => {
    if (isAnotherManager(emp, currentUser)) {
      showToast(
        `Quản lý không có quyền xem thông tin chi tiết của Quản lý khác (${emp.full_name})!`,
        'warning'
      );
      return;
    }
    setSelectedEmpCode(emp.employee_id);
    setSearchParams({ id: emp.employee_id });
  };

  const handlePrevEmployee = () => {
    const list = employees.filter(e => !isAnotherManager(e, currentUser));
    if (list.length === 0) return;
    const currentIndex = list.findIndex(e => e.employee_id === currentEmp?.employee_id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    handleSelectEmployee(list[prevIndex]);
  };

  const handleNextEmployee = () => {
    const list = employees.filter(e => !isAnotherManager(e, currentUser));
    if (list.length === 0) return;
    const currentIndex = list.findIndex(e => e.employee_id === currentEmp?.employee_id);
    const nextIndex = (currentIndex + 1) % list.length;
    handleSelectEmployee(list[nextIndex]);
  };

  // ==========================
  // 1. DATE RANGE & FILTERS FOR ATTENDANCE
  // ==========================
  const todayVN = getTodayVNString();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const startOfCurrentMonth = `${currentYear}-${currentMonth}-01`;

  const [startDate, setStartDate] = useState<string>(() => startOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(() => todayVN);
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState<string>('ALL');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'payroll' | 'schedule' | 'account'>('overview');
  const [quickPreset, setQuickPreset] = useState<'today' | 'month' | 'all' | 'custom'>('month');

  // Quick Date Range Preset helper
  const setQuickRange = (preset: 'today' | 'month' | 'all') => {
    setQuickPreset(preset);
    if (preset === 'today') {
      const d = getTodayVNString();
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'month') {
      setStartDate(startOfCurrentMonth);
      setEndDate(getTodayVNString());
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
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
        if (attendanceTypeFilter === 'CHECK_IN' && record.type !== 'CHECK_IN') return false;
        if (attendanceTypeFilter === 'CHECK_OUT' && record.type !== 'CHECK_OUT' && record.type !== 'TAN_CA') return false;
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

  // Past months payroll history
  const pastPayrolls = useMemo(() => {
    return employeePayrolls;
  }, [employeePayrolls]);

  // ==========================
  // 4. SHIFTS DATA
  // ==========================
  const employeeShifts = useMemo(() => {
    if (!currentEmp) return [];
    return workShifts
      .filter(s => s.employee_id === currentEmp.employee_id || s.employee_id === currentEmp.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workShifts, currentEmp]);

  // ==========================
  // 5. MODAL STATES
  // ==========================
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPayslipModal, setSelectedPayslipModal] = useState<PayrollRecord | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<EmployeeEditFormData>({
    full_name: '',
    department: '',
    position: '',
    phone: '',
    email: '',
    hourly_rate: 100000,
    status: 'ACTIVE',
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

  // Nếu người dùng là Quản lý và đang cố truy cập chi tiết của Quản lý khác
  if (isAnotherManager(currentEmp, currentUser)) {
    return (
      <div className="space-y-6 pb-12">
        <EmployeeDetailHeader
          currentEmp={currentEmp}
          employees={employees}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectEmployee={handleSelectEmployee}
          onPrevEmployee={handlePrevEmployee}
          onNextEmployee={handleNextEmployee}
          onOpenEditModal={handleOpenEditModal}
          onPrint={handlePrint}
          attendanceTotalLogs={0}
          shiftsCount={0}
        />
        <div className="p-10 text-center bg-white dark:bg-[#13162b] border border-amber-300/70 dark:border-amber-900/40 rounded-2xl shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/60 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
            Giới Hạn Quyền Xem Chi Tiết
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
            Bạn đang đăng nhập với vai trò <strong className="text-purple-600 dark:text-purple-400">Quản lý (Manager)</strong>.
            Theo quy định phân quyền, Quản lý có thể xem danh sách nhân viên nhưng{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              không có quyền xem trang chi tiết của Quản lý khác
            </strong>{' '}
            ({currentEmp.full_name} - {currentEmp.employee_id}).
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/manager/employees')}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Quay lại danh sách nhân viên
            </button>
            {employees.find(e => !isAnotherManager(e, currentUser)) && (
              <button
                type="button"
                onClick={() => {
                  const fallback = employees.find(e => !isAnotherManager(e, currentUser));
                  if (fallback) handleSelectEmployee(fallback);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#272d5a] transition-all cursor-pointer"
              >
                Xem nhân sự khác
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Switcher */}
      <EmployeeDetailHeader
        currentEmp={currentEmp}
        employees={employees}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectEmployee={handleSelectEmployee}
        onPrevEmployee={handlePrevEmployee}
        onNextEmployee={handleNextEmployee}
        onOpenEditModal={handleOpenEditModal}
        onPrint={handlePrint}
        attendanceTotalLogs={attendanceStats.totalLogs}
        shiftsCount={employeeShifts.length}
      />

      {/* 2. TAB 1: OVERVIEW & BIOMETRICS */}
      {activeTab === 'overview' && (
        <EmployeeOverviewTab
          currentEmp={currentEmp}
          hourlyRate={hourlyRate}
          standardHours={standardHours}
          overtimeHours={overtimeHours}
          lateEarlyHours={lateEarlyHours}
          currentNetSalary={currentNetSalary}
          workDays={attendanceStats.workDays}
          onOpenEditModal={handleOpenEditModal}
        />
      )}

      {/* 3. TAB 2: ATTENDANCE & CHECK-IN / CHECK-OUT LOGS */}
      {activeTab === 'attendance' && (
        <EmployeeAttendanceTab
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          quickPreset={quickPreset}
          setQuickRange={setQuickRange}
          setQuickPreset={setQuickPreset}
          attendanceTypeFilter={attendanceTypeFilter}
          setAttendanceTypeFilter={setAttendanceTypeFilter}
          attendanceStatusFilter={attendanceStatusFilter}
          setAttendanceStatusFilter={setAttendanceStatusFilter}
          attendanceStats={attendanceStats}
          employeeAttendanceLogs={employeeAttendanceLogs}
        />
      )}

      {/* 4. TAB 3: SALARY DETAILS & PAST MONTHS PAYROLLS */}
      {activeTab === 'payroll' && (
        <EmployeePayrollTab
          currentPeriodKey={currentPeriodKey}
          currentMonthPayroll={currentMonthPayroll}
          hourlyRate={hourlyRate}
          currentNetSalary={currentNetSalary}
          baseSalary={baseSalary}
          standardHours={standardHours}
          overtimeHours={overtimeHours}
          otAmount={otAmount}
          allowance={allowance}
          lateEarlyHours={lateEarlyHours}
          penaltyAmount={penaltyAmount}
          workDays={attendanceStats.workDays}
          otRate={otRate}
          penaltyRate={penaltyRate}
          pastPayrolls={pastPayrolls}
          onSelectPayslip={setSelectedPayslipModal}
        />
      )}

      {/* 5. TAB 4: WORK SCHEDULES */}
      {activeTab === 'schedule' && (
        <EmployeeScheduleTab
          currentEmp={currentEmp}
          employeeShifts={employeeShifts}
        />
      )}

      {/* 6. TAB 5: ACCOUNT & CREDENTIALS */}
      {activeTab === 'account' && (
        <EmployeeAccountTab
          currentEmp={currentEmp}
          onUpdateStatus={async (newStatus) => {
            await updateEmployee(currentEmp.id || currentEmp.employee_id, {
              status: newStatus,
            });
          }}
          showToast={showToast}
        />
      )}

      {/* 6. MODAL EDIT EMPLOYEE */}
      <EmployeeEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentEmp={currentEmp}
        formData={editForm}
        setFormData={setEditForm}
        onSubmit={handleSaveEdit}
      />

      {/* 7. MODAL PAYSLIP VIEWER */}
      <EmployeePayslipModal
        payslip={selectedPayslipModal}
        onClose={() => setSelectedPayslipModal(null)}
        currentEmp={currentEmp}
        hourlyRate={hourlyRate}
        otRate={otRate}
        penaltyRate={penaltyRate}
      />
    </div>
  );
};
