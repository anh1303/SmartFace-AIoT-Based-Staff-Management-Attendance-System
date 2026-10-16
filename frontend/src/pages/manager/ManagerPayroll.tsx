import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isAnotherManager } from '../../utils/permissionUtils';
import { PayrollRecord } from '../../types';
import { logger } from '../../utils/logger';
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
} from '../../features/payroll';

const payrollLogger = logger.child('ManagerPayroll');

export const ManagerPayroll: React.FC = () => {
  const { role, currentUser } = useAuth();
  const {
    payroll,
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

  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Modal state for Bonus Penalty Policy
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyData, setPolicyData] = useState<PolicyFormData>({
    overtime_rate: 100000,
    late_early_penalty: 50000,
    description: '',
  });

  const handleOpenPolicyModal = () => {
    if (role !== 'admin') {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền cấu hình hệ số thưởng OT và phạt đi trễ!', 'error');
      return;
    }
    setPolicyData({
      overtime_rate: bonusPenalty ? Number(bonusPenalty.overtime_rate) : 100000,
      late_early_penalty: bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000,
      description: bonusPenalty?.description || '',
    });
    setIsPolicyModalOpen(true);
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
  // Chốt chặn Requirement 1: Quản lý không xem được phiếu lương hoặc thông tin lương của Quản lý khác
  const allPeriodRecords = payroll.filter((p) => {
    const isPeriodMatch = p.period === selectedPeriod || p.payroll_period === selectedPeriod;
    if (!isPeriodMatch) return false;

    if (role !== 'admin') {
      const emp = employees.find((e) => e.employee_id === p.employee_id);
      if (emp) {
        const isSelf = Boolean(
          currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
        );
        if (!isSelf && isAnotherManager(emp, currentUser)) {
          return false;
        }
      }
    }
    return true;
  });
  const isFinalized =
    allPeriodRecords.length > 0 && allPeriodRecords.every((p) => p.status === 'FINALIZED');

  // Compute metrics
  const totalExpense = allPeriodRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);

  // Filter records by selected period, search term, and position/department
  const currentRecords = allPeriodRecords.filter((p) => {
    const emp = employees.find((e) => e.employee_id === p.employee_id);
    const dept = emp?.department || p.department || '';
    const pos = emp?.position || '';

    if (departmentFilter !== 'ALL' && dept !== departmentFilter && pos !== departmentFilter) {
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

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const lateRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const handleOpenEdit = (record: PayrollRecord) => {
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
    }

    setEditingItem({
      record,
      empName: emp?.full_name || record.employee_name || record.employee_id,
      hourly_rate: record.hourly_rate || 100000,
      working_hours: record.total_working_hours || 176,
      total_overtime: record.total_overtime ?? 0,
      total_late_early: record.total_late_early ?? 0,
      allowance: record.allowance || 0,
    });
  };

  const handleConfirmEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

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
    }

    updatePayrollItem(editingItem.record.payroll_id, {
      hourly_rate: editingItem.hourly_rate,
      working_hours: editingItem.working_hours,
      total_overtime: editingItem.total_overtime,
      total_late_early: editingItem.total_late_early,
      allowance: editingItem.allowance,
    });

    showToast(`Đã lưu thay đổi bảng lương cho ${editingItem.empName}!`, 'success');
    setEditingItem(null);
  };

  const handleFinalizeConfirm = () => {
    finalizePayrollPeriod(selectedPeriod);
    setConfirmFinalizeOpen(false);
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
      'Phụ Cấp (VNĐ)',
      'Thực Lĩnh Net (VNĐ)',
      'Trạng Thái',
    ];

    const recordsToExport = currentRecords.length > 0 ? currentRecords : allPeriodRecords;
    const rows = recordsToExport.map((r) => {
      const emp = employees.find((e) => e.employee_id === r.employee_id);
      const name = emp?.full_name || r.employee_name || r.employee_id;
      const statusStr = r.status === 'FINALIZED' ? 'Đã Chốt' : 'Đang Soạn Thảo';

      return [
        r.employee_id,
        `"${name}"`,
        r.period || r.payroll_period || selectedPeriod,
        r.hourly_rate || 0,
        r.total_working_hours || 0,
        r.total_overtime ?? 0,
        r.total_late_early ?? 0,
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

      {/* Bento Table with Search & Position Filter */}
      <PayrollTable
        selectedPeriod={selectedPeriod}
        currentRecords={currentRecords}
        allPeriodRecords={allPeriodRecords}
        employees={employees}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        isFinalized={isFinalized}
        onOpenEdit={handleOpenEdit}
      />

      {/* EDIT MODAL: Modifying fields with live formula preview */}
      <PayrollItemEditModal
        editingItem={editingItem}
        onClose={() => setEditingItem(null)}
        onChangeEditingItem={setEditingItem}
        onConfirmSave={handleConfirmEditSave}
        otRate={otRate}
        lateRate={lateRate}
        selectedPeriod={selectedPeriod}
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
    </div>
  );
};
export default ManagerPayroll;