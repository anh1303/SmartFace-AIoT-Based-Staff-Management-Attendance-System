import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Users, ShieldAlert, Lock } from 'lucide-react';
import { Employee, PayrollRecord } from '../../types';
import { isAnotherManager, isDifferentDepartment } from '../../utils/permissionUtils';
import { getTodayVNString } from '@/utils/dateUtils';
import {
  EmployeeDetailHeader,
  EmployeeOverviewTab,
  EmployeeAttendanceTab,
  EmployeePayrollTab,
  EmployeeScheduleTab,
  EmployeeAccountTab,
  EmployeePayslipModal,
  EditEmployeeModal,
  useDepartmentPositions,
} from '@/features/employees';
import { useEmployeeDetailData } from './hooks/useEmployeeDetailData';

export const ManagerEmployeeDetail: React.FC = () => {
  const {
    employees,
    updateEmployee,
    showToast
  } = useApp();

  const { currentUser, role } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Chỉ áp dụng giới hạn khi người dùng thực sự là Quản lý (Manager), không áp dụng cho Admin
  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  // Giới hạn danh sách nhân viên: Manager chỉ xem phòng ban mình phụ trách và bản thân
  const scopedEmployees = useMemo(() => {
    if (isManager && managerDept) {
      return employees.filter(e => {
        const isMyDept = e.department?.toLowerCase() === managerDept.toLowerCase();
        const isSelf =
          (currentUser?.employee_id && (e.employee_id === currentUser.employee_id || e.id === currentUser.employee_id)) ||
          (currentUser?.email && e.email?.toLowerCase() === currentUser.email?.toLowerCase());
        return isMyDept || isSelf;
      });
    }
    return employees;
  }, [employees, isManager, managerDept, currentUser]);

  // Get selected employee ID from route params, query string, or default to first allowed employee
  const urlEmployeeId = params.id || searchParams.get('id') || searchParams.get('employee_id');

  const [selectedEmpCode, setSelectedEmpCode] = useState<string>(() => {
    if (urlEmployeeId) {
      const match = scopedEmployees.find(
        e => e.employee_id === urlEmployeeId || e.id === urlEmployeeId
      );
      if (match) return match.employee_id;
    }
    // Prefer selecting an employee that this user is allowed to view
    const allowed = scopedEmployees.find(e => !isAnotherManager(e, currentUser));
    return allowed?.employee_id || scopedEmployees[0]?.employee_id || '';
  });

  // Keep state synced with URL or employees list
  useEffect(() => {
    if (urlEmployeeId) {
      const match = scopedEmployees.find(
        e => e.employee_id === urlEmployeeId || e.id === urlEmployeeId
      );
      if (match && match.employee_id !== selectedEmpCode) {
        setSelectedEmpCode(match.employee_id);
      }
    } else if (scopedEmployees.length > 0 && !scopedEmployees.some(e => e.employee_id === selectedEmpCode)) {
      const allowed = scopedEmployees.find(e => !isAnotherManager(e, currentUser));
      setSelectedEmpCode(allowed?.employee_id || scopedEmployees[0]?.employee_id || '');
    }
  }, [urlEmployeeId, scopedEmployees, selectedEmpCode, currentUser]);

  // Current selected employee object
  const currentEmp = useMemo(() => {
    return (
      scopedEmployees.find(e => e.employee_id === selectedEmpCode || e.id === selectedEmpCode) ||
      employees.find(e => e.employee_id === selectedEmpCode || e.id === selectedEmpCode) ||
      scopedEmployees[0] ||
      employees[0] ||
      null
    );
  }, [scopedEmployees, employees, selectedEmpCode]);

  const handleSelectEmployee = (emp: Employee) => {
    if (isDifferentDepartment(emp, currentUser)) {
      showToast(
        'Quản lý chỉ có quyền xem thông tin nhân viên thuộc phòng ban mình phụ trách!',
        'warning'
      );
      return;
    }
    if (isAnotherManager(emp, currentUser)) {
      showToast(
        `Quản lý không có quyền xem thông tin chi tiết của Quản lý khác (${emp.full_name})!`,
        'warning'
      );
      return;
    }
    setSelectedEmpCode(emp.employee_id);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('id');nextParams.delete('employee_id');nextParams.set('tab',activeTab);
    navigate(`/app/manager/employees/${encodeURIComponent(emp.employee_id)}?${nextParams}`);
  };

  const handlePrevEmployee = () => {
    const list = scopedEmployees.filter(e => !isAnotherManager(e, currentUser));
    if (list.length === 0) return;
    const currentIndex = list.findIndex(e => e.employee_id === currentEmp?.employee_id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    handleSelectEmployee(list[prevIndex]);
  };

  const handleNextEmployee = () => {
    const list = scopedEmployees.filter(e => !isAnotherManager(e, currentUser));
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

  const [startDate, setStartDate] = useState<string>(() => searchParams.get('date') || startOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(() => searchParams.get('date') || todayVN);
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState<string>('ALL');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('ALL');
  const [activeTab, setActiveTabState] = useState<'overview' | 'attendance' | 'payroll' | 'schedule' | 'account'>(() => { const tab=searchParams.get('tab'); return tab && ['overview','attendance','payroll','schedule','account'].includes(tab) ? tab as 'overview'|'attendance'|'payroll'|'schedule'|'account' : 'overview'; });
  const setActiveTab = (tab: 'overview'|'attendance'|'payroll'|'schedule'|'account') => {setActiveTabState(tab);setSearchParams(previous=>{const next=new URLSearchParams(previous);next.set('tab',tab);return next;},{replace:true});};
  useEffect(()=>{const tab=searchParams.get('tab');if(tab&&['overview','attendance','payroll','schedule','account'].includes(tab))setActiveTabState(tab as typeof activeTab);},[searchParams]);

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
  // 2. ATTENDANCE, STATS, PAYROLL & SHIFTS DATA VIA CUSTOM HOOK
  // ==========================
  const {
    employeeAttendanceLogs,
    attendanceStats,
    hourlyRate,
    standardHours,
    overtimeHours,
    lateEarlyHours,
    currentNetSalary,
    pastPayrolls,
    employeeShifts,
    otRate,
    penaltyRate,
  } = useEmployeeDetailData({
    currentEmp,
    startDate,
    endDate,
    attendanceTypeFilter,
    attendanceStatusFilter,
  });

  // ==========================
  // 5. DEPARTMENT POSITIONS HOOK & MODAL STATES
  // ==========================
  const { rawDepartmentOptions, getPositionsByDepartment } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
  });

  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [selectedPayslipModal, setSelectedPayslipModal] = useState<PayrollRecord | null>(null);

  const handleOpenEditModal = () => {
    if (!currentEmp) return;
    setEditEmployee({ ...currentEmp });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    try {
      await updateEmployee(editEmployee.id || editEmployee.employee_id, {
        full_name: editEmployee.full_name,
        department: editEmployee.department,
        position: editEmployee.position,
        phone: editEmployee.phone,
        email: editEmployee.email,
        hourly_rate: Number(editEmployee.hourly_rate),
        fingerprint_enrolled: editEmployee.fingerprint_enrolled,
      });
      showToast(`Đã cập nhật thông tin nhân viên ${editEmployee.full_name} thành công`, 'success');
      setEditEmployee(null);
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
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/20 cursor-pointer"
        >
          Đến trang danh sách nhân viên
        </button>
      </div>
    );
  }

  // Nếu người dùng là Quản lý và đang cố truy cập nhân viên phòng ban khác
  if (isDifferentDepartment(currentEmp, currentUser)) {
    return (
      <div className="space-y-6 pb-12">
        <div className="p-10 text-center bg-white dark:bg-[#13162b] border border-rose-300/70 dark:border-rose-900/40 rounded-2xl shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800/60 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
            Giới Hạn Quyền Xem Theo Phòng Ban
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
            Bạn đang đăng nhập với vai trò <strong className="text-blue-600 dark:text-blue-400">Quản lý ({managerDept || 'phòng ban'})</strong>.
            Theo quy định phân quyền, Quản lý chỉ có quyền xem thông tin nhân viên thuộc phòng ban mình phụ trách.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/manager/employees')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Quay lại danh sách nhân viên
            </button>
            {scopedEmployees.find(e => !isAnotherManager(e, currentUser)) && (
              <button
                type="button"
                onClick={() => {
                  const fallback = scopedEmployees.find(e => !isAnotherManager(e, currentUser));
                  if (fallback) handleSelectEmployee(fallback);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#272d5a] transition-all cursor-pointer"
              >
                Xem nhân sự phòng mình
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Nếu người dùng là Quản lý và đang cố truy cập chi tiết của Quản lý khác
  if (isAnotherManager(currentEmp, currentUser)) {
    return (
      <div className="space-y-6 pb-12">
        <EmployeeDetailHeader
          currentEmp={currentEmp}
          employees={scopedEmployees}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectEmployee={handleSelectEmployee}
          onPrevEmployee={handlePrevEmployee}
          onNextEmployee={handleNextEmployee}
          onOpenEditModal={handleOpenEditModal}
          onPrint={handlePrint}
        />
        <div className="p-10 text-center bg-white dark:bg-[#13162b] border border-amber-300/70 dark:border-amber-900/40 rounded-2xl shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/60 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
            Giới Hạn Quyền Xem Chi Tiết
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
            Bạn đang đăng nhập với vai trò <strong className="text-blue-600 dark:text-blue-400">Quản lý (Manager)</strong>.
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Quay lại danh sách nhân viên
            </button>
            {scopedEmployees.find(e => !isAnotherManager(e, currentUser)) && (
              <button
                type="button"
                onClick={() => {
                  const fallback = scopedEmployees.find(e => !isAnotherManager(e, currentUser));
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
        employees={scopedEmployees}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectEmployee={handleSelectEmployee}
        onPrevEmployee={handlePrevEmployee}
        onNextEmployee={handleNextEmployee}
        onOpenEditModal={handleOpenEditModal}
        onPrint={handlePrint}
      />

      {activeTab === 'overview' && <div className="flex justify-end">
        <button type="button" onClick={() => setActiveTab('attendance')} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold">
          Xem lịch sử checkin / checkout
        </button>
      </div>}

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
          currentEmp={currentEmp}
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
          hourlyRate={hourlyRate}
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

      {/* 6. MODAL EDIT EMPLOYEE (Tái sử dụng EditEmployeeModal) */}
      <EditEmployeeModal
        editEmployee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onChangeEditEmployee={setEditEmployee}
        departmentOptions={rawDepartmentOptions}
        positionsByDepartment={getPositionsByDepartment}
        onSubmit={handleEditSubmit}
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
