import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Banknote,
  Lock,
  Unlock,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  Edit,
  Check,
  DollarSign
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PayrollRecord } from '../../types';

export const ManagerPayroll: React.FC = () => {
  const {
    payroll,
    bonusPenalty,
    selectedPeriod,
    setSelectedPeriod,
    updatePayrollItem,
    finalizePayrollPeriod,
    unlockPayrollPeriod,
    updateBonusPenalty,
    employees,
    showToast
  } = useApp();

  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);

  // Modal state for Bonus Penalty Policy
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyData, setPolicyData] = useState({
    overtime_rate: 100000,
    late_early_penalty: 50000,
    description: '',
  });

  const handleOpenPolicyModal = () => {
    setPolicyData({
      overtime_rate: bonusPenalty ? Number(bonusPenalty.overtime_rate) : 100000,
      late_early_penalty: bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000,
      description: bonusPenalty?.description || '',
    });
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBonusPenalty(policyData);
    setIsPolicyModalOpen(false);
  };


  // Modal State for Editing a Payroll line item
  const [editingItem, setEditingItem] = useState<{
    record: PayrollRecord;
    empName: string;
    hourly_rate: number;
    working_hours: number;
    total_overtime: number;
    total_late_early: number;
    allowance: number;
  } | null>(null);

  // Dynamic periods generated from payroll records
  const availablePeriods = Array.from(new Set([
    ...payroll.map(p => p.period || p.payroll_period).filter(Boolean) as string[],
    selectedPeriod
  ])).sort().reverse();

  // Filter records by selected period
  const currentRecords = payroll.filter(p => p.period === selectedPeriod || p.payroll_period === selectedPeriod);
  const isFinalized = currentRecords.length > 0 && currentRecords.every(p => p.status === 'FINALIZED');

  // Compute metrics
  const totalExpense = currentRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const lateRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const handleOpenEdit = (record: PayrollRecord) => {
    const emp = employees.find(e => e.employee_id === record.employee_id);
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
    unlockPayrollPeriod(selectedPeriod);
    setConfirmUnlockOpen(false);
  };

  const handleExportCSV = () => {
    showToast(`Đã xuất báo cáo bảng lương kỳ ${selectedPeriod} định dạng CSV!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Bento Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Quản Lý Bảng Lương & Chi Trả
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${isFinalized
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
            >
              {isFinalized ? 'ĐÃ CHỐT SỔ' : 'ĐANG SOẠN THẢO'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Chỉnh sửa các khoản phụ cấp, giảm trừ, số ngày công với nút xác nhận lưu minh bạch và phê duyệt chuyển lương.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-slate-400">Kỳ lương:</span>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none cursor-pointer"
            >
              {availablePeriods.map(period => {
                const [year, month] = period.split('-');
                return (
                  <option key={period} value={period} className="bg-slate-900">
                    Tháng {month}/{year}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Action Button: Finalize or Unlock */}
          {isFinalized ? (
            <button
              type="button"
              onClick={() => setConfirmUnlockOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span>Mở khóa sửa bảng lương</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmFinalizeOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Chốt lương kỳ này</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Bento Metric Cards (Mức thưởng tăng ca, Mức phạt đi trễ/về sớm, Trạng thái kỳ lương) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Mức thưởng tăng ca (Lấy từ bảng bonus_penalty) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group relative">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mức thưởng tăng ca</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPolicyModal}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
              >
                Thay đổi
              </button>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {bonusPenalty?.overtime_rate ? (
              Number(bonusPenalty.overtime_rate) <= 10 ? (
                <span>{bonusPenalty.overtime_rate}x <span className="text-sm font-normal text-slate-400">lương giờ</span></span>
              ) : (
                <span>{Number(bonusPenalty.overtime_rate).toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-400">₫/h</span></span>
              )
            ) : (
              <span>1.5x <span className="text-sm font-normal text-slate-400">lương giờ</span></span>
            )}
          </div>
        </div>

        {/* Card 2: Mức phạt đi trễ / về sớm (Lấy từ bảng bonus_penalty) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group relative">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mức phạt đi trễ / về sớm</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPolicyModal}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
              >
                Thay đổi
              </button>
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-red-400">
            {bonusPenalty?.late_early_penalty ? (
              Number(bonusPenalty.late_early_penalty) <= 10 ? (
                <span>{bonusPenalty.late_early_penalty}x <span className="text-sm font-normal text-slate-400">lương giờ</span></span>
              ) : (
                <span>{Number(bonusPenalty.late_early_penalty).toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-400">₫/h</span></span>
              )
            ) : (
              <span>50.000 <span className="text-sm font-normal text-slate-400">₫/h</span></span>
            )}
          </div>

        </div>


        {/* Card 3: Trạng thái kỳ lương */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Trạng thái kỳ lương</span>
            {isFinalized ? (
              <Lock className="w-4 h-4 text-green-500" />
            ) : (
              <Unlock className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="mt-2 text-xl font-bold font-mono flex items-center gap-2 text-white">
            {isFinalized ? (
              <span className="text-green-500">Đã niêm phong (Khóa)</span>
            ) : (
              <span className="text-amber-400">Đang soạn thảo (Mở)</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {currentRecords.length} nhân sự • Quỹ lương: <span className="font-mono text-white font-medium">{totalExpense.toLocaleString('vi-VN')} ₫</span>
          </p>
        </div>
      </div>

      {/* Bento Table with Explicit Columns: Nhân sự, Lương theo giờ, Tổng giờ làm, Số giờ tăng ca, Số giờ đi trễ/về sớm, Phụ cấp, Thực lĩnh, Chỉnh sửa */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-heading">
              Chi tiết bảng lương từng nhân sự - Kỳ {selectedPeriod}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Xuất Excel / CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold text-white">Nhân sự</th>
                <th className="py-3.5 px-3 min-w-[130px] font-semibold text-white">Lương theo giờ</th>
                <th className="py-3.5 px-3 min-w-[100px] font-semibold text-white">Tổng giờ làm</th>
                <th className="py-3.5 px-3 min-w-[110px] font-semibold text-white">Số giờ tăng ca</th>
                <th className="py-3.5 px-3 min-w-[130px] font-semibold text-white">Số giờ đi trễ/về sớm</th>
                <th className="py-3.5 px-3 min-w-[110px] font-semibold text-white">Phụ cấp</th>
                <th className="py-3.5 px-4 min-w-[130px] font-semibold text-white">Thực lĩnh</th>
                <th className="py-3.5 px-4 text-right font-semibold text-white">Chỉnh sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {currentRecords.map(record => {
                const emp = employees.find(e => e.employee_id === record.employee_id);
                const hourlyRate = record.hourly_rate || 0;
                const netSalary = record.net_salary || 0;
                const totalWorkingHours = record.total_working_hours || 176;
                const totalOvertime = record.total_overtime ?? 0;
                const totalLateEarly = record.total_late_early ?? 0;
                const allowance = record.allowance || 0;

                return (
                  <tr key={record.payroll_id} className="hover:bg-slate-800/40 transition-colors">
                    {/* 1. Nhân sự */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                          alt={emp?.full_name || record.employee_name || record.employee_id}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-semibold text-white truncate">{emp?.full_name || record.employee_name || record.employee_id}</p>
                          <p className="text-[10px] font-mono text-blue-400">{record.employee_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Lương theo giờ */}
                    <td className="py-3.5 px-3 font-mono text-white font-medium">
                      {hourlyRate.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 3. Tổng giờ làm */}
                    <td className="py-3.5 px-3 font-mono text-slate-200">
                      {totalWorkingHours}h
                    </td>

                    {/* 4. Số giờ tăng ca */}
                    <td className="py-3.5 px-3 font-mono">
                      {totalOvertime > 0 ? (
                        <span className="text-amber-400 font-semibold font-mono">+{totalOvertime}h</span>
                      ) : (
                        <span className="text-slate-400">0h</span>
                      )}
                    </td>

                    {/* 5. Số giờ đi trễ/về sớm */}
                    <td className="py-3.5 px-3 font-mono">
                      {totalLateEarly > 0 ? (
                        <span className="text-red-400 font-semibold font-mono">-{totalLateEarly}h</span>
                      ) : (
                        <span className="text-green-400 font-medium">0h</span>
                      )}
                    </td>

                    {/* 6. Phụ cấp */}
                    <td className="py-3.5 px-3 font-mono text-green-400 font-medium">
                      {allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </td>

                    {/* 7. Thực lĩnh */}
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                      {netSalary.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 8. Chỉnh sửa */}
                    <td className="py-3.5 px-4 text-right">
                      {isFinalized ? (
                        <span className="text-[11px] font-mono text-slate-500">Đã khóa</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(record)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 ml-auto transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL: Modifying fields with live formula preview */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Chỉnh sửa chi tiết lương nhân viên"
        subtitle={`Nhân sự: ${editingItem?.empName} • Mã: ${editingItem?.record.employee_id} • Kỳ ${selectedPeriod}`}
        maxWidth="md"
      >
        {editingItem && (
          <form onSubmit={handleConfirmEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lương theo giờ (VNĐ/h):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  value={editingItem.hourly_rate}
                  onChange={e => setEditingItem({ ...editingItem, hourly_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tổng số giờ làm việc (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={editingItem.working_hours}
                  onChange={e => setEditingItem({ ...editingItem, working_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số giờ tăng ca (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingItem.total_overtime}
                  onChange={e => setEditingItem({ ...editingItem, total_overtime: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số giờ đi trễ / về sớm (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingItem.total_late_early}
                  onChange={e => setEditingItem({ ...editingItem, total_late_early: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-red-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phụ cấp (VNĐ):
              </label>
              <input
                type="number"
                step="50000"
                min="0"
                value={editingItem.allowance}
                onChange={e => setEditingItem({ ...editingItem, allowance: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-green-400 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Live Net preview */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Lương cơ bản: {(editingItem.hourly_rate * editingItem.working_hours).toLocaleString('vi-VN')} ₫</span>
                <span>Thưởng OT: {((otRate <= 10 ? editingItem.total_overtime * editingItem.hourly_rate * otRate : editingItem.total_overtime * otRate)).toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Phạt đi trễ: -{((lateRate <= 10 ? editingItem.total_late_early * editingItem.hourly_rate * lateRate : editingItem.total_late_early * lateRate)).toLocaleString('vi-VN')} ₫</span>
                <span>Phụ cấp: +{editingItem.allowance.toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Lương thực lĩnh (Net):</span>
                <span className="font-mono text-base font-bold text-white">
                  {Math.max(
                    0,
                    Math.round(
                      editingItem.hourly_rate * editingItem.working_hours +
                      (otRate <= 10 ? editingItem.total_overtime * editingItem.hourly_rate * otRate : editingItem.total_overtime * otRate) -
                      (lateRate <= 10 ? editingItem.total_late_early * editingItem.hourly_rate * lateRate : editingItem.total_late_early * lateRate) +
                      editingItem.allowance
                    )
                  ).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            {/* Explicit Confirm Button */}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận cập nhật bảng lương</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Modal: Finalize */}
      <Modal
        isOpen={confirmFinalizeOpen}
        onClose={() => setConfirmFinalizeOpen(false)}
        title="Xác nhận chốt bảng lương kỳ này?"
        subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold">Lưu ý bảo mật:</p>
              <p className="mt-1 text-slate-300">
                Sau khi chốt sổ, toàn bộ dữ liệu lương sẽ được khóa (read-only), nhân viên có thể xem phiếu lương chi tiết và kế toán sẽ tiến hành giải ngân qua ngân hàng.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Tổng ngân sách chi trả:</span>
              <span className="font-mono text-white font-bold">{totalExpense.toLocaleString('vi-VN')} ₫</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số lượng nhân viên:</span>
              <span className="font-mono text-white">{currentRecords.length} người</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmFinalizeOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleFinalizeConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
            >
              Đồng ý chốt bảng lương
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Unlock */}
      <Modal
        isOpen={confirmUnlockOpen}
        onClose={() => setConfirmUnlockOpen(false)}
        title="Mở khóa chỉnh sửa bảng lương?"
        subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Bạn đang yêu cầu mở khóa bảng lương kỳ <strong>{selectedPeriod}</strong>. Trạng thái sẽ được chuyển về <strong>ĐANG SOẠN THẢO</strong> để cho phép chỉnh sửa số liệu.
          </p>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmUnlockOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleUnlockConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md"
            >
              Mở khóa chỉnh sửa
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Bonus / Penalty Policy */}
      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        title="Thay đổi quy định Thưởng / Phạt"
        subtitle="Thiết lập hệ số tăng ca (OT) và định mức vi phạm đi trễ / về sớm"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Mức thưởng OT (Hệ số x hoặc ₫/h)</label>
            <input
              type="number"
              step="any"
              value={policyData.overtime_rate}
              onChange={(e) => setPolicyData(p => ({ ...p, overtime_rate: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              placeholder="Ví dụ: 1.5 (gấp 1.5x) hoặc 100000 (100.000 ₫/h)"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Nhập ≤ 10 nếu là hệ số nhân lương giờ (VD: 1.5x), nhập &gt; 10 nếu là số tiền ₫/h (VD: 100000 ₫/h).</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Mức phạt đi trễ / về sớm (Hệ số x hoặc ₫/h)</label>
            <input
              type="number"
              step="any"
              value={policyData.late_early_penalty}
              onChange={(e) => setPolicyData(p => ({ ...p, late_early_penalty: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              placeholder="Ví dụ: 50000 (50.000 ₫/h)"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Nhập ≤ 10 nếu là hệ số khấu trừ lương giờ, nhập &gt; 10 nếu là số tiền phạt ₫/h.</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Ghi chú / Mô tả quy định</label>
            <textarea
              rows={2}
              value={policyData.description}
              onChange={(e) => setPolicyData(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="Mô tả chính sách áp dụng..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPolicyModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
            >
              Lưu thay đổi quy định
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};