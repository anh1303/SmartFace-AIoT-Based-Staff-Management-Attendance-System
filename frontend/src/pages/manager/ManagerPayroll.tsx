import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isAnotherManager, isDifferentDepartment } from '../../utils/permissionUtils';
import { PayrollRecord } from '../../types';
import { logger } from '../../utils/logger';
import { nextPayrollPolicyPeriod } from '../../utils/payrollUtils';
import { buildPayrollItemUpdates } from '../../features/payrolls/components/PayrollItemEditModal';
import { useDepartmentPositions } from '@/features/employees';
import {
  PayrollHeader,
  PayrollSummaryCards,
  PayrollTable,
  PayrollItemEditModal,
  EditingPayrollItem,
  PayrollPolicyModal,
  PolicyFormData,
  PayrollFinalizeModal,
  PayrollUnlockModal,
  EarlySettlementModal,
} from '@/features/payrolls';
import { earlySettlementPayrollApi, fetchBonusPenaltyApi } from '../../api/payrollApi';
import { useAttendanceSummaries } from '../../features/attendances/hooks/useAttendanceSummaries';
import { payrollAttendanceTotals } from '../../features/payrolls/payrollAttendance';
import { useShiftContext } from '../../context/ShiftContext';
import { formatVNDateISO } from '../../utils/dateUtils';

const payrollLogger = logger.child('ManagerPayroll');

export const ManagerPayroll: React.FC = () => {
  const { role, currentUser } = useAuth();
  const {
    payroll,
    isLoadingPayroll,
    payrollError,
    bonusPenalty,
    selectedPeriod,
    setSelectedPeriod,
    generatePayroll,
    updatePayrollItem,
    finalizePayrollPeriod,
    unlockPayrollPeriod,
    updateBonusPenalty,
    employees,
    showToast,
  } = useApp();

  const isManager = role === 'manager';
  const shifts = useShiftContext();
  const monthEnd = new Date(Date.UTC(Number(selectedPeriod.slice(0, 4)), Number(selectedPeriod.slice(5, 7)), 0)).getUTCDate();
  const attendanceSummary = useAttendanceSummaries(`${selectedPeriod}-01`, `${selectedPeriod}-${String(monthEnd).padStart(2, '0')}`);
  const attendanceTotals = useMemo(() => payrollAttendanceTotals(attendanceSummary.summaries, shifts.workShifts), [attendanceSummary.summaries, shifts.workShifts]);
  const unprocessedEmployeeIds = useMemo(() => {
    const today = formatVNDateISO(new Date());
    const summarized = new Set(attendanceSummary.summaries.flatMap(s => [`${s.employee_id}_${s.date}`, `${s.employee_uuid}_${s.date}`]));
    return new Set(shifts.workShifts.filter(s => s.date.startsWith(selectedPeriod) && s.date < today && s.shift_type !== 'OFF' && !summarized.has(`${s.employee_id}_${s.date}`)).map(s => s.employee_id));
  }, [attendanceSummary.summaries, shifts.workShifts, selectedPeriod]);
  const managerDept = currentUser?.department;

  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(() => {
    if (role === 'manager' && currentUser?.department) {
      return currentUser.department;
    }
    return 'ALL';
  });
  const [positionFilter, setPositionFilter] = useState('ALL');

  useEffect(() => {
    if (isManager && managerDept) {
      setDepartmentFilter(managerDept);
    }
  }, [isManager, managerDept]);

  const {
    departmentOptions,
    positionOptions,
  } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
    departmentFilter,
  });

  // Modal state for Bonus Penalty Policy
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyData, setPolicyData] = useState<PolicyFormData>({
    overtime_rate: 2.0,
    late_early_penalty: 1.5,
    absence_penalty_rate: 2.0,
    effective_period: nextPayrollPolicyPeriod(),
    description: '',
  });

  const handleOpenPolicyModal = async () => {
    if (role !== 'admin') {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền cấu hình hệ số thưởng OT và phạt đi trễ!', 'error');
      return;
    }
    try {
      const effectivePeriod = nextPayrollPolicyPeriod();
      const base = await fetchBonusPenaltyApi(effectivePeriod);
      if (!base) throw new Error('Chưa xác định chính sách cho kỳ hiệu lực');
      setPolicyData({
        overtime_rate: Number(base.overtime_rate),
        late_early_penalty: Number(base.late_early_penalty),
        absence_penalty_rate: Number(base.absence_penalty_rate),
        description: base.description || '',
        effective_period: effectivePeriod,
      });
      setIsPolicyModalOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tải được chính sách', 'error');
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin') {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền cấu hình hệ số thưởng OT và phạt đi trễ!', 'error');
      setIsPolicyModalOpen(false);
      return;
    }
    await updateBonusPenalty(policyData);
    setIsPolicyModalOpen(false);
  };

  // Modal State for Editing a Payroll line item
  const [editingItem, setEditingItem] = useState<EditingPayrollItem | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [earlySettlementRecord, setEarlySettlementRecord] = useState<PayrollRecord | null>(null);

  // Dynamic periods generated from payroll records
  const availablePeriods = Array.from(
    new Set([
      ...(payroll.map((p) => p.period || p.payroll_period).filter(Boolean) as string[]),
      selectedPeriod,
    ])
  )
    .sort()
    .reverse();

  // All records for the selected period (for status & total metrics)
  // Chốt chặn phân quyền: Quản lý chỉ xem được phiếu lương của chính mình và nhân viên phòng ban mình phụ trách
  const allPeriodRecords = payroll.filter((p) => {
    const isPeriodMatch = p.period === selectedPeriod || p.payroll_period === selectedPeriod;
    if (!isPeriodMatch) return false;

    if (role !== 'admin') {
      const emp = employees.find((e) => e.employee_id === p.employee_id);
      const isSelf = Boolean(
        currentUser && (
          p.employee_id === currentUser.employee_id ||
          (emp && (emp.employee_id === currentUser.employee_id || emp.email?.toLowerCase() === currentUser.email?.toLowerCase()))
        )
      );

      // Nếu là chính mình: Luôn cho phép xem lương của bản thân
      if (isSelf) return true;

      // Nếu là Manager xem người khác:
      if (isManager && managerDept) {
        const empDept = emp?.department || p.department;
        // Nhân viên phòng ban khác: HOÀN TOÀN KHÔNG HIỆN
        if (!empDept || empDept.toLowerCase() !== managerDept.toLowerCase()) {
          return false;
        }
        // Quản lý khác trong cùng phòng: HOÀN TOÀN KHÔNG HIỆN
        if (emp && isAnotherManager(emp, currentUser)) {
          return false;
        }
      } else return false;
    }
    return true;
  });
  const controlledPeriodRecords = allPeriodRecords.filter(p => role === 'admin' || p.employee_id !== currentUser?.employee_id);
  const isFinalized =
    controlledPeriodRecords.length > 0 && controlledPeriodRecords.every((p) => p.status !== 'PENDING');

  // Compute metrics
  const totalExpense = allPeriodRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);

  // Filter records by selected period, search term, and position/department
  const currentRecords = allPeriodRecords.filter((p) => {
    const emp = employees.find((e) => e.employee_id === p.employee_id);
    const dept = emp?.department || p.department || '';
    const pos = emp?.position || '';

    if (departmentFilter !== 'ALL' && dept !== departmentFilter) {
      return false;
    }

    if (positionFilter !== 'ALL' && pos !== positionFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (emp?.full_name || p.employee_name || '').toLowerCase().includes(term);
      const matchId = (p.employee_id || '').toLowerCase().includes(term);
      const matchDept = dept.toLowerCase().includes(term);
      const matchPos = pos.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchDept && !matchPos) return false;
    }

    return true;
  });

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 2;
  const lateRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 1.5;

  const handleOpenEdit = (record: PayrollRecord) => {
    if (record.status !== 'PENDING') {
      showToast('Bảng lương kỳ này đã bị Khóa. Cần mở khóa kỳ trước khi sửa phiếu lương!', 'warning');
      return;
    }
    const emp = employees.find((e) => e.employee_id === record.employee_id);
    if (role !== 'admin') {
      const isSelf = Boolean(
        emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
      );
      if (isSelf) {
        showToast('Chốt chặn an toàn: Bạn không thể tự sửa phiếu lương của chính mình!', 'error');
        return;
      }
      if (isAnotherManager(emp, currentUser)) {
        showToast('Quản lý không có quyền sửa phiếu lương của Quản lý khác!', 'error');
        return;
      }
      if (isDifferentDepartment(emp, currentUser)) {
        showToast('Quản lý chỉ có quyền xem/sửa phiếu lương của nhân viên thuộc phòng ban mình phụ trách!', 'error');
        return;
      }
    }

    setEditingItem({
      record,
      empName: emp?.full_name || record.employee_name || record.employee_id,
      allowance: record.allowance ?? 0,
      reason: '',
    });
  };

  const handleConfirmEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (editingItem.record.status !== 'PENDING') {
      showToast(`Không thể chỉnh sửa phiếu lương ở trạng thái ${editingItem.record.status}. Chỉ có thể chỉnh sửa khi ở trạng thái PENDING (Chờ duyệt)!`, 'error');
      return;
    }

    const emp = employees.find((e) => e.employee_id === editingItem.record.employee_id);
    if (role !== 'admin') {
      const isSelf = Boolean(
        emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
      );
      if (isSelf) {
        showToast('Chốt chặn an toàn: Bạn không thể tự sửa phiếu lương của chính mình!', 'error');
        return;
      }
      if (isAnotherManager(emp, currentUser)) {
        showToast('Quản lý không có quyền sửa phiếu lương của Quản lý khác!', 'error');
        return;
      }
      if (isDifferentDepartment(emp, currentUser)) {
        showToast('Quản lý chỉ có quyền xem/sửa phiếu lương của nhân viên thuộc phòng ban mình phụ trách!', 'error');
        return;
      }
    }

    try {
      setIsSavingItem(true);
      await updatePayrollItem(editingItem.record.payroll_id, buildPayrollItemUpdates(editingItem));

      showToast(`Đã lưu thay đổi bảng lương cho ${editingItem.empName}!`, 'success');
      setEditingItem(null);
    } catch (err: any) {
      payrollLogger.error('Lỗi khi cập nhật phiếu lương:', err);
      showToast(err.message || 'Lỗi khi cập nhật phiếu lương', 'error');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleFinalizeConfirm = () => {
    finalizePayrollPeriod(selectedPeriod);
    setConfirmFinalizeOpen(false);
  };

  const handleEarlySettlementConfirm = async (cutoffDate: string, reason: string) => {
    if (!earlySettlementRecord) return;
    try {
      await earlySettlementPayrollApi({
        employeeId: earlySettlementRecord.employee_id,
        period: selectedPeriod,
        cutoffDate,
        reason,
      });
      showToast(`Đã quyết toán sớm bảng lương cho nhân viên ${earlySettlementRecord.employee_name || earlySettlementRecord.employee_id}!`, 'success');
      setEarlySettlementRecord(null);
      await generatePayroll(selectedPeriod);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi quyết toán sớm', 'error');
      throw err;
    }
  };

  const handleUnlockConfirm = () => {
    if (role !== 'admin') {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền mở khóa bảng lương!', 'error');
      setConfirmUnlockOpen(false);
      return;
    }
    unlockPayrollPeriod(selectedPeriod);
    setConfirmUnlockOpen(false);
  };

  const handleCalculatePayroll = async () => {
    try {
      setIsCalculating(true);
      await generatePayroll(selectedPeriod);
    } catch (error: any) {
      payrollLogger.error('Lỗi khi tính toán bảng lương:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExportCSV = () => {
    if (allPeriodRecords.length === 0) {
      showToast(`Kỳ ${selectedPeriod} chưa có dữ liệu bảng lương để xuất CSV!`, 'warning');
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và Tên',
      'Kỳ Lương',
      'Lương Theo Giờ (VNĐ)',
      'Tổng Giờ Làm (h)',
      'Số Giờ Tăng Ca (h)',
      'Số Giờ Đi Trễ / Về Sớm (h)',
      'Phạt Vắng Ca (VNĐ)',
      'Phụ Cấp (VNĐ)',
      'Thực Lĩnh Net (VNĐ)',
      'Trạng Thái',
    ];

    const recordsToExport = currentRecords.length > 0 ? currentRecords : allPeriodRecords;
    const rows = recordsToExport.map((r) => {
      const emp = employees.find((e) => e.employee_id === r.employee_id);
      const name = emp?.full_name || r.employee_name || r.employee_id;
      const statusStr = r.status === 'PAID'
        ? 'Đã Thanh Toán'
        : r.status === 'FINALIZED'
        ? 'Đã Chốt'
        : r.status === 'CONFIRMED'
        ? 'Đã Xác Nhận'
        : 'Đang Soạn Thảo';

      return [
        r.employee_id,
        `"${name}"`,
        r.period || r.payroll_period || selectedPeriod,
        r.hourly_rate || 0,
        r.total_working_hours || 0,
        r.total_overtime ?? 0,
        r.total_late_early ?? 0,
        r.total_absence_penalty || 0,
        r.allowance || 0,
        r.net_salary || 0,
        `"${statusStr}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_luong_chi_tiet_ky_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất báo cáo bảng lương kỳ ${selectedPeriod} định dạng CSV!`, 'success');
  };

  return (
    <div className="space-y-6">
      {payrollError && <p className="sf-feedback error" role="alert">Không thể tải bảng lương: {payrollError.message}</p>}
      {isLoadingPayroll && <p role="status">Đang tải bảng lương…</p>}
      {/* Bento Top Header */}
      <PayrollHeader
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        availablePeriods={availablePeriods}
        isCalculating={isCalculating}
        isFinalized={isFinalized}
        onCalculatePayroll={handleCalculatePayroll}
        onOpenFinalizeModal={() => setConfirmFinalizeOpen(true)}
        onOpenUnlockModal={() => setConfirmUnlockOpen(true)}
        onExportCSV={handleExportCSV}
      />

      {/* 3 Bento Metric Cards */}
      <PayrollSummaryCards
        bonusPenalty={bonusPenalty}
        isFinalized={isFinalized}
        allPeriodRecords={allPeriodRecords}
        totalExpense={totalExpense}
        onOpenPolicyModal={handleOpenPolicyModal}
      />

      <div>
      {attendanceSummary.isError && <p className="sf-feedback error mb-4" role="alert">Không tải được dữ liệu chấm công để tính số ca nghỉ. <button type="button" className="underline" onClick={() => attendanceSummary.refetch()}>Thử lại</button></p>}
      {shifts.isError && <p className="sf-feedback error mb-4" role="alert">Không tải được lịch ca để tính số ca nghỉ. <button type="button" className="underline" onClick={shifts.refetchShifts}>Thử lại</button></p>}

      {/* Bento Table with Search & Position Filter */}
      <PayrollTable
        selectedPeriod={selectedPeriod}
        currentRecords={currentRecords}
        allPeriodRecords={allPeriodRecords}
        employees={employees}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(val) => {
          if (isManager && managerDept && val !== managerDept && val !== 'ALL') {
            return;
          }
          setDepartmentFilter(val);
          setPositionFilter('ALL');
        }}
        departmentOptions={departmentOptions}
        allDepartmentLabel={isManager ? '' : 'Tất cả phòng ban'}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positionOptions={positionOptions}
        isFinalized={isFinalized}
        onOpenEdit={handleOpenEdit}
        onOpenEarlySettlement={(record) => setEarlySettlementRecord(record)}
        attendanceTotals={attendanceTotals}
        unprocessedEmployeeIds={unprocessedEmployeeIds}
        attendanceUnavailable={attendanceSummary.isLoading || attendanceSummary.isError || shifts.isLoading || shifts.isError}
      />

      </div>

      {/* EDIT MODAL: Modifying fields with live formula preview */}
      <PayrollItemEditModal
        editingItem={editingItem}
        onClose={() => setEditingItem(null)}
        onChangeEditingItem={setEditingItem}
        onConfirmSave={handleConfirmEditSave}
        absenceLabel={attendanceSummary.isLoading || attendanceSummary.isError || shifts.isLoading || shifts.isError ? '—' : editingItem && unprocessedEmployeeIds.has(editingItem.record.employee_id) ? 'Chưa tổng hợp' : `${editingItem ? attendanceTotals.get(editingItem.record.employee_id) ?? 0 : 0} ca`}
        otRate={otRate}
        lateRate={lateRate}
        selectedPeriod={selectedPeriod}
        isSubmitting={isSavingItem}
      />

      {/* Confirmation Modal: Finalize */}
      <PayrollFinalizeModal
        isOpen={confirmFinalizeOpen}
        onClose={() => setConfirmFinalizeOpen(false)}
        selectedPeriod={selectedPeriod}
        totalExpense={totalExpense}
        employeeCount={currentRecords.length}
        onConfirm={handleFinalizeConfirm}
      />

      {/* Confirmation Modal: Unlock */}
      <PayrollUnlockModal
        isOpen={confirmUnlockOpen}
        onClose={() => setConfirmUnlockOpen(false)}
        selectedPeriod={selectedPeriod}
        onConfirm={handleUnlockConfirm}
      />

      {/* Modal: Edit Bonus / Penalty Policy */}
      <PayrollPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policyData={policyData}
        onChangePolicyData={setPolicyData}
        onSavePolicy={handleSavePolicy}
      />

      {/* Modal: Early Settlement for offboarding employee */}
      <EarlySettlementModal
        isOpen={Boolean(earlySettlementRecord)}
        onClose={() => setEarlySettlementRecord(null)}
        selectedPeriod={selectedPeriod}
        record={earlySettlementRecord}
        employeeName={
          employees.find((e) => e.employee_id === earlySettlementRecord?.employee_id)?.full_name ||
          earlySettlementRecord?.employee_name ||
          earlySettlementRecord?.employee_id ||
          ''
        }
        onConfirm={handleEarlySettlementConfirm}
      />
    </div>
  );
};
export default ManagerPayroll;
