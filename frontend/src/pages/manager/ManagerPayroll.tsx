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
    selectedPeriod, 
    setSelectedPeriod, 
    updatePayrollItem, 
    finalizePayrollPeriod, 
    unlockPayrollPeriod, 
    employees, 
    showToast 
  } = useApp();

  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);

  // Modal State for Editing a Payroll line item
  const [editingItem, setEditingItem] = useState<{
    record: PayrollRecord;
    empName: string;
    base_salary: number;
    working_days: number;
    working_hours: number;
    allowance: number;
    deduction: number;
  } | null>(null);

  // Filter records by selected period
  const currentRecords = payroll.filter(p => p.period === selectedPeriod);
  const isFinalized = currentRecords.length > 0 && currentRecords.every(p => p.status === 'FINALIZED');

  // Compute metrics
  const totalExpense = currentRecords.reduce((sum, r) => sum + r.total_paid, 0);

  const handleOpenEdit = (record: PayrollRecord) => {
    const emp = employees.find(e => e.employee_id === record.employee_id);
    setEditingItem({
      record,
      empName: emp?.full_name || record.employee_id,
      base_salary: record.base_salary,
      working_days: record.working_days,
      working_hours: record.working_hours,
      allowance: record.allowance,
      deduction: record.deduction
    });
  };

  const handleConfirmEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const net = Math.max(0, editingItem.base_salary + editingItem.allowance - editingItem.deduction);

    updatePayrollItem(editingItem.record.payroll_id, {
      base_salary: editingItem.base_salary,
      working_days: editingItem.working_days,
      working_hours: editingItem.working_hours,
      allowance: editingItem.allowance,
      deduction: editingItem.deduction,
      total_paid: net
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
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                isFinalized
                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {isFinalized ? 'ĐÃ CHỐT SỔ (FINALIZED)' : 'ĐANG SOẠN THẢO (PENDING)'}
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
              <option value="2026-08" className="bg-slate-900">Tháng 08/2026</option>
              <option value="2026-07" className="bg-slate-900">Tháng 07/2026</option>
              <option value="2026-06" className="bg-slate-900">Tháng 06/2026</option>
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

      {/* 3 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng quỹ lương kỳ này</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {totalExpense.toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-400">₫</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đã bao gồm phụ cấp & khấu trừ</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Nhân sự nhận lương</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {currentRecords.length} <span className="text-sm font-normal text-slate-400">người</span>
          </div>
          <p className="text-[11px] text-green-500 mt-1 font-medium">100% nhân sự có hồ sơ hợp lệ</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Trạng thái bảo mật</span>
          <div className="mt-2 text-xl font-bold font-mono flex items-center gap-2 text-white">
            {isFinalized ? (
              <>
                <Lock className="w-5 h-5 text-green-500" />
                <span className="text-green-500">Niêm phong</span>
              </>
            ) : (
              <>
                <Unlock className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400">Đang soạn thảo</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isFinalized ? 'Bảng lương đã khóa đối với sửa đổi' : 'Yêu cầu nút xác nhận trước khi lưu'}
          </p>
        </div>
      </div>

      {/* Bento Table with Explicit Edit Confirmation */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-heading">
              Chi tiết bảng lương từng nhân sự - Kỳ {selectedPeriod}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Thay đổi số liệu thông qua nút &quot;Chỉnh sửa&quot; và xác nhận lưu để tránh nhầm lẫn.
            </p>
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
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Nhân sự</th>
                <th className="py-3.5 px-3 min-w-[130px] font-medium">Lương cơ bản</th>
                <th className="py-3.5 px-3 min-w-[90px] font-medium">Ngày công</th>
                <th className="py-3.5 px-3 min-w-[80px] font-medium">Giờ làm</th>
                <th className="py-3.5 px-3 min-w-[110px] font-medium">Phụ cấp & OT</th>
                <th className="py-3.5 px-3 min-w-[110px] font-medium">Khấu trừ</th>
                <th className="py-3.5 px-3 min-w-[80px] font-medium">Đi trễ</th>
                <th className="py-3.5 px-4 font-medium">Thực lĩnh (Net)</th>
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {currentRecords.map(record => {
                const emp = employees.find(e => e.employee_id === record.employee_id);

                return (
                  <tr key={record.payroll_id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Employee Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar}
                          alt={emp?.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-semibold text-white truncate">{emp?.full_name}</p>
                          <p className="text-[10px] font-mono text-blue-400">{record.employee_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td className="py-3.5 px-3 font-mono text-white font-medium">
                      {record.base_salary.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Working Days */}
                    <td className="py-3.5 px-3 font-mono text-slate-300">
                      {record.working_days} ngày
                    </td>

                    {/* Working Hours */}
                    <td className="py-3.5 px-3 font-mono text-slate-300">
                      {record.working_hours}h
                    </td>

                    {/* Allowance */}
                    <td className="py-3.5 px-3 font-mono text-green-400">
                      +{record.allowance.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Deduction */}
                    <td className="py-3.5 px-3 font-mono text-red-400">
                      -{record.deduction.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Late Count */}
                    <td className="py-3.5 px-3 font-mono">
                      {record.late_count > 0 ? (
                        <span className="text-amber-400 font-bold">{record.late_count} lần</span>
                      ) : (
                        <span className="text-green-500 font-medium">0</span>
                      )}
                    </td>

                    {/* Total Net Paid */}
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                      {record.total_paid.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Edit Action Button */}
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

      {/* EDIT MODAL: Modifying fields requires explicit confirmation */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Chỉnh sửa chi tiết lương nhân viên"
        subtitle={`Nhân sự: ${editingItem?.empName} • Mã: ${editingItem?.record.employee_id} • Kỳ ${selectedPeriod}`}
        maxWidth="md"
      >
        {editingItem && (
          <form onSubmit={handleConfirmEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lương cơ bản hợp đồng (VNĐ):
              </label>
              <input
                type="number"
                step="100000"
                required
                value={editingItem.base_salary}
                onChange={e => setEditingItem({ ...editingItem, base_salary: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số ngày công tính lương:
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="31"
                  required
                  value={editingItem.working_days}
                  onChange={e => setEditingItem({ ...editingItem, working_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tổng số giờ làm việc:
                </label>
                <input
                  type="number"
                  step="1"
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
                  Phụ cấp & Thưởng OT (VNĐ):
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Khấu trừ & Phạt vi phạm (VNĐ):
                </label>
                <input
                  type="number"
                  step="50000"
                  min="0"
                  value={editingItem.deduction}
                  onChange={e => setEditingItem({ ...editingItem, deduction: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-red-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Live Net preview */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Lương thực lĩnh dự kiến (Net):</span>
              <span className="font-mono text-base font-bold text-white">
                {Math.max(0, editingItem.base_salary + editingItem.allowance - editingItem.deduction).toLocaleString('vi-VN')} ₫
              </span>
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
            Bạn đang yêu cầu mở khóa bảng lương kỳ <strong>{selectedPeriod}</strong>. Trạng thái sẽ được chuyển về <strong>ĐANG SOẠN THẢO (PENDING)</strong> để cho phép chỉnh sửa số liệu.
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
    </div>
  );
};
