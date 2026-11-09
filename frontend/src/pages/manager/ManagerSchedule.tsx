import { useOperations, OperationFailedError, UncertainWriteError, submitAndWait, type Operation } from '../../features/operations';
import { ActionButton } from '../../components/common/ActionFeedback';
import { submitScheduleBatch, submitScheduleCopy } from '../../features/schedules';
import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useEmployeeContext } from '../../context/EmployeeContext';
import { useShiftContext } from '../../context/ShiftContext';
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
  exportScheduleToExcel,
  employeesWithScheduledShifts,
} from '@/features/schedules';
import { getMonday, formatDateToYYYYMMDD, getISOWeekNumber, getTodayVNString } from '@/utils/dateUtils';
import { useDepartmentPositions } from '@/features/employees';

export const ManagerSchedule: React.FC = () => {
  const { jobs } = useOperations();
  const [pendingCommand, setPendingCommand] = useState<(() => Promise<Operation>) | null>(null);
  const [failedJob, setFailedJob] = useState<Operation | null>(null);
  const scheduleBusy = jobs.some(job => job.type === 'shifts.batch' && ['queued', 'running'].includes(job.status));
  const employeeState = useEmployeeContext();
  const shiftState = useShiftContext();
  const { employees } = employeeState;
  const { workShifts, assignOrUpdateShift } = shiftState;
  const { showToast } = useToast();
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
  const [saving,setSaving]=useState(false);
  const [shiftError,setShiftError]=useState('');
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
  const [bulkEndTime, setBulkEndTime] = useState('17:00');
  const [bulkDays, setBulkDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri default
  const [bulkNote, setBulkNote] = useState('');

  // Form state inside modal
  const [modalShiftType, setModalShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [modalStartTime, setModalStartTime] = useState('08:00');
  const [modalEndTime, setModalEndTime] = useState('17:00');
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
    showToast('Đã chuyển về tuần làm việc hiện tại!', 'info', "Chuyển tuần làm việc");
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
    if (scheduleBusy) { showToast('Lịch đang được cập nhật nền. Vui lòng chờ kết quả.', 'error', "Không thể chỉnh sửa ca làm việc"); return; }
    const todayVN = getTodayVNString();
    const isPast = date < todayVN;

    const targetEmp = employees.find(e => e.employee_id === empId);

    if (!isPast) {
      if (targetEmp?.status === 'INACTIVE') {
        showToast(`Nhân viên ${empName} đang ở trạng thái TẠM NGƯNG, không thể phân bổ hoặc chỉnh sửa ca làm việc!`, 'error', "Không thể chỉnh sửa ca làm việc");
        return;
      }

      if (role !== 'admin') {
        const isSelf = currentUser && (empId === currentUser.employee_id || targetEmp?.email === currentUser.email);
        if (isSelf) {
          showToast('Không ai được tự phân ca hoặc sửa ca làm việc của chính mình. Vui lòng liên hệ Admin phê duyệt!', 'error', "Không thể chỉnh sửa ca làm việc");
          return;
        }
        if (isAnotherManager(targetEmp, currentUser)) {
          showToast(`Quản lý không có quyền phân ca hoặc sửa đổi ca làm việc của Quản lý khác (${empName})!`, 'error', "Không thể chỉnh sửa ca làm việc");
          return;
        }
      }
    }

    const existing = workShifts.find(s => s.employee_id === empId && s.date === date);
    setShiftError('');
    setEditingShift({
      employeeId: empId,
      employeeName: empName,
      date,
      dayLabel,
      shift: existing,
      isPast,
    });

    if (existing) {
      setModalShiftType(existing.shift_type);
      setModalStartTime(existing.start_time);
      setModalEndTime(existing.end_time);
      setModalNote(existing.note || '');
    } else {
      setModalShiftType('OFFICE_HOURS');
      setModalStartTime('08:00');
      setModalEndTime('17:00');
      setModalNote('');
    }
  };

  const handleShiftSave = async (e: React.FormEvent) => {
    if (scheduleBusy) { e.preventDefault(); showToast('Lịch đang được cập nhật nền. Vui lòng chờ kết quả trước khi sửa tiếp.', 'error', "Không thể phân công ca làm việc"); return; }
    e.preventDefault();
    if (!editingShift) return;

    if (editingShift.isPast) {
      showToast('Không thể thay đổi ca làm việc của ngày trong quá khứ!', 'error', "Không thể phân công ca làm việc");
      return;
    }

    if (modalShiftType === 'OTHER') {
      const s = modalStartTime?.trim();
      const endT = modalEndTime?.trim();
      if (!s || !endT || s === endT) {
        showToast('Giờ bắt đầu và kết thúc phải khác nhau. Giờ kết thúc sớm hơn thuộc ngày hôm sau.', 'error', "Không thể phân công ca làm việc");
        return;
      }
    }

    const emp = employees.find(e => e.employee_id === editingShift.employeeId);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayIndex = new Date(`${editingShift.date}T00:00:00.000Z`).getUTCDay();
    const workDay = editingShift.shift?.work_day || dayNames[dayIndex];

    setSaving(true);setShiftError('');
    try {await assignOrUpdateShift({
      version: editingShift.shift?.version,
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

    showToast(`Đã ${editingShift.shift ? 'cập nhật' : 'phân công'} ${({ MORNING: 'ca sáng', AFTERNOON: 'ca chiều', OFFICE_HOURS: 'ca hành chính', OTHER: 'ca tùy chỉnh', OFF: 'nghỉ ca' })[modalShiftType]} cho ${emp?.full_name || editingShift.employeeId} (${editingShift.employeeId}) vào ngày ${editingShift.date.split('-').reverse().join('/')}.`, 'success', editingShift.shift ? 'Cập nhật ca làm việc thành công' : 'Phân công ca làm việc thành công');
    setEditingShift(null);
    } catch(error) { const reason = (error as Error).message || 'Chưa lưu được ca.'; setShiftError(reason); showToast(`${emp?.full_name || editingShift.employeeId}, ngày ${editingShift.date.split('-').reverse().join('/')}: ${reason} Kiểm tra lịch và chọn ca phù hợp trước khi lưu lại.`, 'error', 'Không thể phân công ca làm việc'); } finally {setSaving(false);}
  };



  // Bulk shift assignment submission
  const handleBulkSubmit = async (e: React.FormEvent) => {
    if (scheduleBusy) { e.preventDefault(); showToast('Lịch đang được cập nhật. Vui lòng chờ tác vụ hoàn tất.', 'error', "Không thể phân công ca làm việc"); return; }
    e.preventDefault();
    if (bulkDays.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ngày trong tuần để áp dụng ca!', 'error', "Không thể phân công ca làm việc");
      return;
    }

    if (bulkShiftType === 'OTHER') {
      const s = bulkStartTime?.trim();
      const endT = bulkEndTime?.trim();
      if (!s || !endT || s === endT) {
        showToast('Giờ bắt đầu và kết thúc phải khác nhau. Giờ kết thúc sớm hơn thuộc ngày hôm sau.', 'error', "Không thể phân công ca làm việc");
        return;
      }
    }

    let targetEmps = employees.filter(e => e.status === 'ACTIVE' && (!isManager || (Boolean(managerDept) && e.department === managerDept)));
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
      showToast('Không có nhân sự hợp lệ nào để phân ca (đã loại trừ tài khoản cá nhân và Quản lý khác)!', 'error', "Không thể phân công ca làm việc");
      return;
    }

    const assignments = targetEmps.flatMap(emp => bulkDays.map(offset => {
      const d = new Date(currentMonday); d.setDate(d.getDate() + offset);
      const date = formatDateToYYYYMMDD(d);
      const existing = workShifts.find(s => s.employee_id === emp.employee_id && s.date === date);
      return { employee_id: emp.employee_id, date, shift_type: bulkShiftType, start_time: bulkStartTime, end_time: bulkEndTime, note: bulkNote, expectedVersion: existing ? existing.version ?? 1 : null };
    }));
    setSaving(true); setShiftError('');
    const command = () => submitScheduleBatch(assignments);
    setPendingCommand(() => command);
    try { await command(); setPendingCommand(null); setFailedJob(null); await shiftState.refetchShifts(); setBulkModalOpen(false); showToast(`Đã phân công ${assignments.length} ô lịch cho ${targetEmps.length} nhân viên, từ ${startLabel} đến ${endLabel}.`, 'success', 'Phân công ca làm việc thành công'); }
    catch (error) { const message = error instanceof Error ? error.message : 'Chưa gửi được yêu cầu'; setShiftError(message); if (error instanceof OperationFailedError) setFailedJob(error.operation); if (!(error instanceof UncertainWriteError)) setPendingCommand(null); showToast(message, 'error', "Không thể phân công ca làm việc"); }
    finally { setSaving(false); }
  };

  const handleCopyPreviousWeek = async () => {
    if (scheduleBusy || saving) { showToast('Lịch đang được cập nhật. Vui lòng chờ tác vụ hoàn tất.', 'error', "Không thể sao chép lịch làm việc"); return; }
    const prevMonday = new Date(currentMonday); prevMonday.setDate(prevMonday.getDate() - 7);
    const targets = employees.filter(emp => emp.status === 'ACTIVE' && (role === 'admin' || (emp.department === managerDept && emp.employee_id !== currentUser?.employee_id && !isAnotherManager(emp, currentUser))));
    if (!targets.length) { showToast('Không có nhân viên phù hợp để sao chép lịch.', 'error', "Không thể sao chép lịch làm việc"); return; }
    const expectedTargetVersions: Record<string, number | null> = {};
    for (const emp of targets) for (const day of daysOfWeek) {
      const shift = workShifts.find(s => s.employee_id === emp.employee_id && s.date === day.date);
      expectedTargetVersions[`${emp.employee_id}:${day.date}`] = shift ? shift.version ?? 1 : null;
    }
    setSaving(true); setShiftError('');
    const command = () => submitScheduleCopy({ sourceMonday: formatDateToYYYYMMDD(prevMonday), targetMonday: formatDateToYYYYMMDD(currentMonday), employeeIds: targets.map(e => e.employee_id), expectedTargetVersions });
    setPendingCommand(() => command);
    try { await command(); setPendingCommand(null); setFailedJob(null); await shiftState.refetchShifts(); showToast(`Đã sao chép lịch tuần trước cho ${targets.length} nhân viên, từ ${startLabel} đến ${endLabel}.`, 'success', 'Sao chép lịch làm việc thành công'); }
    catch (error) { const message = error instanceof Error ? error.message : 'Chưa sao chép được lịch'; setShiftError(message); if (error instanceof OperationFailedError) setFailedJob(error.operation); if (!(error instanceof UncertainWriteError)) setPendingCommand(null); showToast(message, 'error', "Không thể sao chép lịch làm việc"); }
    finally { setSaving(false); }
  };

  const handleExportExcel = (format: 'excel' | 'pdf') => {
    if (!canExport) return;
    return exportScheduleToExcel({
      format,
      filteredEmployees,
      daysOfWeek,
      workShifts,
      weekNumber,
      startLabel,
      endLabel,
      showToast,
    });
  };

  const resumeAction = pendingCommand && shiftError ? <ActionButton busyLabel="Đang kiểm tra…" className="sf-button mt-3" onClick={async () => {
    setSaving(true);
    try { const result = await pendingCommand(); setPendingCommand(null); setShiftError(''); setFailedJob(null); await shiftState.refetchShifts(); setBulkModalOpen(false); showToast(`Đã xác nhận lưu ${result.progress.succeeded} ô lịch; ${result.progress.skipped} ô được bỏ qua.`, 'success', 'Lưu lịch làm việc thành công'); }
    catch (error) { if (error instanceof OperationFailedError) { setFailedJob(error.operation); setPendingCommand(null); } setShiftError(error instanceof Error ? error.message : 'Chưa xác định kết quả.'); }
    finally { setSaving(false); }
  }}>Kiểm tra kết quả yêu cầu đã gửi</ActionButton> : null;

  const retryAction = failedJob ? <ActionButton busyLabel="Đang thử lại…" disabled={saving} className="sf-button mt-3" onClick={async () => {
        setSaving(true);
        try {
          await submitAndWait(`/api/operations/${failedJob.jobId}/retry`, {});
          setFailedJob(null); setShiftError(''); await shiftState.refetchShifts(); setBulkModalOpen(false);
          showToast('Đã lưu các ca thử lại.', 'success', "Phân công lại ca làm việc thành công");
        } catch (error) { if (error instanceof OperationFailedError) setFailedJob(error.operation); throw error; }
        finally { setSaving(false); }
      }}>Thử lại các ca lỗi</ActionButton> : null;

  const canExport = !employeeState.isLoading && !employeeState.isError && !shiftState.isLoading && !shiftState.isError && employeesWithScheduledShifts(filteredEmployees, daysOfWeek, workShifts).length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Header with week navigator, bulk & copy actions */}
      <ScheduleHeader
        busy={saving || Boolean(pendingCommand)}
        currentMonday={currentMonday}
        weekNumber={weekNumber}
        startLabel={startLabel}
        endLabel={endLabel}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onGoCurrentWeek={handleGoCurrentWeek}
        onDateSelect={handleDateSelect}
        onCopyPreviousWeek={handleCopyPreviousWeek}
        onOpenBulkModal={() => {setShiftError('');setFailedJob(null);setBulkModalOpen(true);}}
        onExportExcel={handleExportExcel}
        canExport={canExport}
      />

      {shiftError && !bulkModalOpen && !editingShift && <p role="alert" className="sf-feedback error">{shiftError}</p>}
      {!bulkModalOpen && (resumeAction || retryAction)}
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
        isReadOnly={Boolean(editingShift?.isPast)}
        isSubmitting={saving}
        error={shiftError}
        onClose={() => {if(!saving)setEditingShift(null);}}
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
        failureActions={resumeAction || retryAction}
        isOpen={bulkModalOpen}
        isSubmitting={saving}
        error={shiftError}
        onClose={() => {if(!saving)setBulkModalOpen(false);}}
        weekNumber={weekNumber}
        startLabel={startLabel}
        endLabel={endLabel}
        employees={isManager ? employees.filter(e => Boolean(managerDept) && e.department === managerDept) : employees}
        departments={dbDepartments}
        managerDepartment={isManager ? managerDept || null : undefined}
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
