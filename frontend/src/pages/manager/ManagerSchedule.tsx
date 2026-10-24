import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isAnotherManager } from '../../utils/permissionUtils';
import { WorkShift } from '../../types';
import {
  ScheduleHeader,
  ScheduleWeekNavigator,
  ScheduleMatrixTable,
  ScheduleLegend,
  ShiftEditModal,
  EditingShiftTarget,
  BulkShiftModal,
} from '@/features/schedules';
import { getMonday, formatDateToYYYYMMDD, getISOWeekNumber } from '@/utils/dateUtils';
import { useDepartmentPositions } from '@/features/employees';

export const ManagerSchedule: React.FC = () => {
  const { employees, workShifts, assignOrUpdateShift, showToast } = useApp();
  const { currentUser, role } = useAuth();
  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  const [departmentFilter, setDepartmentFilter] = useState(() => {
    if (role === 'manager' && currentUser?.department) {
      return currentUser.department;
    }
    return 'ALL';
  });
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingShift, setEditingShift] = useState<EditingShiftTarget | null>(null);

  useEffect(() => {
    if (isManager && managerDept) {
      setDepartmentFilter(managerDept);
    }
  }, [isManager, managerDept]);

  const { departmentOptions, positionOptions, dbDepartments } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
    departmentFilter,
  });

  // Solar Calendar Week State (Default Monday of current week)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));

  // Bulk Shift Assignment Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<'ALL' | 'DEPARTMENT' | string>('ALL');
  const [bulkDepartment, setBulkDepartment] = useState('Nhân viên');
  const [bulkShiftType, setBulkShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [bulkStartTime, setBulkStartTime] = useState('08:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:30');
  const [bulkDays, setBulkDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri default
  const [bulkNote, setBulkNote] = useState('');

  // Form state inside modal
  const [modalShiftType, setModalShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [modalStartTime, setModalStartTime] = useState('08:00');
  const [modalEndTime, setModalEndTime] = useState('17:30');
  const [modalNote, setModalNote] = useState('');

  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + offset);
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const dateStr = formatDateToYYYYMMDD(d);
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    return {
      name: dayNames[offset],
      date: dateStr,
      label: `${dayNum}/${monthNum}`,
      offset,
    };
  });

  const weekNumber = getISOWeekNumber(currentMonday);
  const startDateObj = currentMonday;
  const endDateObj = new Date(currentMonday);
  endDateObj.setDate(currentMonday.getDate() + 6);

  const startLabel = `${String(startDateObj.getDate()).padStart(2, '0')}/${String(startDateObj.getMonth() + 1).padStart(2, '0')}`;
  const endLabel = `${String(endDateObj.getDate()).padStart(2, '0')}/${String(endDateObj.getMonth() + 1).padStart(2, '0')}`;

  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleGoCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
    showToast('Đã chuyển về tuần làm việc hiện tại!', 'info');
  };

  const handleDateSelect = (dateString: string) => {
    if (!dateString) return;
    const selected = new Date(dateString);
    if (!isNaN(selected.getTime())) {
      setCurrentMonday(getMonday(selected));
    }
  };



  const filteredEmployees = employees.filter(e => {
    if (departmentFilter !== 'ALL' && e.department !== departmentFilter) return false;
    if (positionFilter !== 'ALL' && e.position !== positionFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = e.full_name?.toLowerCase().includes(term);
      const matchId = e.employee_id?.toLowerCase().includes(term);
      const matchDept = e.department?.toLowerCase().includes(term);
      const matchPos = e.position?.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchDept && !matchPos) return false;
    }
    return true;
  });

  const handleCellClick = (empId: string, empName: string, date: string, dayLabel: string) => {
    const targetEmp = employees.find(e => e.employee_id === empId);
    if (targetEmp?.status === 'INACTIVE') {
      showToast(`Nhân viên ${empName} đang ở trạng thái TẠM NGƯNG, không thể phân bổ hoặc chỉnh sửa ca làm việc!`, 'warning');
      return;
    }

    if (role !== 'admin') {
      const isSelf = currentUser && (empId === currentUser.employee_id || targetEmp?.email === currentUser.email);
      if (isSelf) {
        showToast('Không ai được tự phân ca hoặc sửa ca làm việc của chính mình. Vui lòng liên hệ Admin phê duyệt!', 'warning');
        return;
      }
      if (isAnotherManager(targetEmp, currentUser)) {
        showToast(`Quản lý không có quyền phân ca hoặc sửa đổi ca làm việc của Quản lý khác (${empName})!`, 'warning');
        return;
      }
    }

    const existing = workShifts.find(s => s.employee_id === empId && s.date === date);
    setEditingShift({
      employeeId: empId,
      employeeName: empName,
      date,
      dayLabel,
      shift: existing
    });

    if (existing) {
      setModalShiftType(existing.shift_type);
      setModalStartTime(existing.start_time);
      setModalEndTime(existing.end_time);
      setModalNote(existing.note || '');
    } else {
      setModalShiftType('OFFICE_HOURS');
      setModalStartTime('08:00');
      setModalEndTime('17:30');
      setModalNote('');
    }
  };

  const handleShiftSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    const emp = employees.find(e => e.employee_id === editingShift.employeeId);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayIndex = new Date(`${editingShift.date}T00:00:00.000Z`).getUTCDay();
    const workDay = editingShift.shift?.work_day || dayNames[dayIndex];

    assignOrUpdateShift({
      shift_id: editingShift.shift?.shift_id,
      employee_id: editingShift.employeeId,
      date: editingShift.date,
      work_day: workDay,
      start_time: modalShiftType === 'OFF' ? '00:00' : modalStartTime,
      end_time: modalShiftType === 'OFF' ? '00:00' : modalEndTime,
      shift_type: modalShiftType,
      department: emp?.department || 'Nhân viên',
      note: modalNote,
    });

    setEditingShift(null);
  };

  // Bulk shift assignment submission
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDays.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ngày trong tuần để áp dụng ca!', 'warning');
      return;
    }

    let targetEmps = employees.filter(e => e.status !== 'INACTIVE');
    if (bulkTarget === 'DEPARTMENT') {
      targetEmps = targetEmps.filter(e => e.department === bulkDepartment);
    } else if (bulkTarget !== 'ALL') {
      targetEmps = targetEmps.filter(e => e.employee_id === bulkTarget);
    }

    // Lọc bỏ chính mình và các manager khác nếu không phải Admin
    if (role !== 'admin') {
      targetEmps = targetEmps.filter(e => {
        const isSelf = currentUser && (e.employee_id === currentUser.employee_id || e.email === currentUser.email);
        const isOtherMgr = isAnotherManager(e, currentUser);
        return !isSelf && !isOtherMgr;
      });
    }

    if (targetEmps.length === 0) {
      showToast('Không có nhân sự hợp lệ nào để phân ca (đã loại trừ tài khoản cá nhân và Quản lý khác)!', 'warning');
      return;
    }

    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
    let count = 0;

    targetEmps.forEach(emp => {
      bulkDays.forEach(dayOffset => {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + dayOffset);
        const dateStr = formatDateToYYYYMMDD(d);
        const existing = workShifts.find(s => s.employee_id === emp.employee_id && s.date === dateStr);

        assignOrUpdateShift({
          shift_id: existing?.shift_id,
          employee_id: emp.employee_id,
          date: dateStr,
          work_day: dayNames[dayOffset],
          start_time: bulkShiftType === 'OFF' ? '00:00' : bulkStartTime,
          end_time: bulkShiftType === 'OFF' ? '00:00' : bulkEndTime,
          shift_type: bulkShiftType,
          department: emp.department || 'Nhân viên',
          note: bulkNote,
        });
        count++;
      });
    });

    setBulkModalOpen(false);
    showToast(`Đã phân ca hàng loạt thành công cho ${targetEmps.length} nhân sự (${count} ca trực)!`, 'success');
  };

  // Copy shifts from previous week
  const handleCopyPreviousWeek = () => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

    let copiedCount = 0;
    let activeEmps = employees.filter(e => e.status !== 'INACTIVE');

    if (role !== 'admin') {
      activeEmps = activeEmps.filter(e => {
        const isSelf = currentUser && (e.employee_id === currentUser.employee_id || e.email === currentUser.email);
        const isOtherMgr = isAnotherManager(e, currentUser);
        return !isSelf && !isOtherMgr;
      });
    }

    activeEmps.forEach(emp => {
      [0, 1, 2, 3, 4, 5, 6].forEach(offset => {
        const prevDateObj = new Date(prevMonday);
        prevDateObj.setDate(prevMonday.getDate() + offset);
        const prevDateStr = formatDateToYYYYMMDD(prevDateObj);

        const currDateObj = new Date(currentMonday);
        currDateObj.setDate(currentMonday.getDate() + offset);
        const currDateStr = formatDateToYYYYMMDD(currDateObj);

        const prevShift = workShifts.find(s => s.employee_id === emp.employee_id && s.date === prevDateStr);
        const currShift = workShifts.find(s => s.employee_id === emp.employee_id && s.date === currDateStr);

        if (prevShift) {
          assignOrUpdateShift({
            shift_id: currShift?.shift_id,
            employee_id: emp.employee_id,
            date: currDateStr,
            work_day: dayNames[offset],
            start_time: prevShift.start_time,
            end_time: prevShift.end_time,
            shift_type: prevShift.shift_type,
            department: emp.department || 'Nhân viên',
            note: prevShift.note || 'Sao chép tuần trước',
          });
          copiedCount++;
        }
      });
    });

    if (copiedCount > 0) {
      showToast(`Đã sao chép thành công ${copiedCount} ca làm việc từ tuần trước!`, 'success');
    } else {
      showToast('Không tìm thấy dữ liệu ca làm việc ở tuần trước để sao chép!', 'warning');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with week navigator, bulk & copy actions */}
      <ScheduleHeader
        currentMonday={currentMonday}
        weekNumber={weekNumber}
        startLabel={startLabel}
        endLabel={endLabel}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onGoCurrentWeek={handleGoCurrentWeek}
        onDateSelect={handleDateSelect}
        onCopyPreviousWeek={handleCopyPreviousWeek}
        onOpenBulkModal={() => setBulkModalOpen(true)}
      />

      {/* 2. Filters */}
      <ScheduleWeekNavigator
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(val) => {
          setDepartmentFilter(val);
          setPositionFilter('ALL');
        }}
        departmentOptions={departmentOptions}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positionOptions={positionOptions}
      />

      {/* 3. Interactive Shift Matrix Grid */}
      <ScheduleMatrixTable
        filteredEmployees={filteredEmployees}
        daysOfWeek={daysOfWeek}
        workShifts={workShifts}
        onCellClick={handleCellClick}
      />

      {/* 4. Help legend */}
      <ScheduleLegend />

      {/* 5. Edit Shift Modal */}
      <ShiftEditModal
        editingShift={editingShift}
        onClose={() => setEditingShift(null)}
        shiftType={modalShiftType}
        setShiftType={setModalShiftType}
        startTime={modalStartTime}
        setStartTime={setModalStartTime}
        endTime={modalEndTime}
        setEndTime={setModalEndTime}
        note={modalNote}
        setNote={setModalNote}
        onSubmit={handleShiftSave}
      />

      {/* 6. Bulk Shift Assignment Modal */}
      <BulkShiftModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        weekNumber={weekNumber}
        startLabel={startLabel}
        endLabel={endLabel}
        employees={employees}
        departments={dbDepartments}
        bulkTarget={bulkTarget}
        setBulkTarget={setBulkTarget}
        bulkDepartment={bulkDepartment}
        setBulkDepartment={setBulkDepartment}
        bulkShiftType={bulkShiftType}
        setBulkShiftType={setBulkShiftType}
        bulkStartTime={bulkStartTime}
        setBulkStartTime={setBulkStartTime}
        bulkEndTime={bulkEndTime}
        setBulkEndTime={setBulkEndTime}
        bulkDays={bulkDays}
        setBulkDays={setBulkDays}
        bulkNote={bulkNote}
        setBulkNote={setBulkNote}
        onSubmit={handleBulkSubmit}
      />
    </div>
  );
};