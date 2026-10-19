import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Check } from 'lucide-react';
import { PayrollRecord } from '../../../types';

export interface EditingPayrollItem {
  record: PayrollRecord;
  empName: string;
  hourly_rate: number;
  working_hours: number;
  total_overtime: number;
  total_late_early: number;
  allowance: number;
  reason: string;
}

interface PayrollItemEditModalProps {
  editingItem: EditingPayrollItem | null;
  onClose: () => void;
  onChangeEditingItem: (item: EditingPayrollItem) => void;
  onConfirmSave: (e: React.FormEvent) => void;
  otRate: number;
  lateRate: number;
  selectedPeriod: string;
}

export const PayrollItemEditModal: React.FC<PayrollItemEditModalProps> = ({
  editingItem,
  onClose,
  onChangeEditingItem,
  onConfirmSave,
  otRate,
  lateRate,
  selectedPeriod,
}) => {
  if (!editingItem) return null;
  otRate = editingItem.record.overtime_rate ?? otRate;
  lateRate = editingItem.record.late_penalty_rate ?? lateRate;

  return (
    <Modal
      isOpen={Boolean(editingItem)}
      onClose={onClose}
      title="Chỉnh sửa chi tiết lương nhân viên"
      subtitle={`Nhân sự: ${editingItem.empName} • Mã: ${editingItem.record.employee_id} • Kỳ ${selectedPeriod}`}
      maxWidth="md"
    >
      <form onSubmit={onConfirmSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lương theo giờ (VNĐ/h):
            </label>
            <input
              type="number"
              step="1000"
              min="0"
              required
              value={editingItem.hourly_rate}
              onChange={(e) =>
                onChangeEditingItem({
                  ...editingItem,
                  hourly_rate: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tổng số giờ làm việc (h):
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              required
              value={editingItem.working_hours}
              onChange={(e) =>
                onChangeEditingItem({
                  ...editingItem,
                  working_hours: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Số giờ tăng ca (h):
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={editingItem.total_overtime}
              onChange={(e) =>
                onChangeEditingItem({
                  ...editingItem,
                  total_overtime: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-amber-600 dark:text-amber-400 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Số giờ đi trễ / về sớm (h):
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={editingItem.total_late_early}
              onChange={(e) =>
                onChangeEditingItem({
                  ...editingItem,
                  total_late_early: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-rose-600 dark:text-rose-400 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Phụ cấp (VNĐ):
          </label>
          <input
            type="number"
            step="50000"
            min="0"
            value={editingItem.allowance}
            onChange={(e) =>
              onChangeEditingItem({
                ...editingItem,
                allowance: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-mono focus:outline-none focus:border-purple-500"
          />
        </div>

        <label className="block text-xs">Lý do điều chỉnh (bắt buộc khi sửa giờ công/OT)
          <textarea required minLength={3} maxLength={2000} value={editingItem.reason}
            onChange={e => onChangeEditingItem({ ...editingItem, reason: e.target.value })}
            className="block w-full bg-transparent rounded border p-2" />
        </label>
        {/* Live Net preview */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
            <span>
              Lương cơ bản:{' '}
              {(editingItem.hourly_rate * editingItem.working_hours).toLocaleString('vi-VN')} ₫
            </span>
            <span>
              Thưởng OT:{' '}
              {(otRate <= 10
                ? editingItem.total_overtime * editingItem.hourly_rate * otRate
                : editingItem.total_overtime * otRate
              ).toLocaleString('vi-VN')}{' '}
              ₫
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
            <span>
              Phạt đi trễ: -
              {(lateRate <= 10
                ? editingItem.total_late_early * editingItem.hourly_rate * lateRate
                : editingItem.total_late_early * lateRate
              ).toLocaleString('vi-VN')}{' '}
              ₫
            </span>
            <span>Phụ cấp: +{editingItem.allowance.toLocaleString('vi-VN')} ₫</span>
          </div>
          <div className="border-t border-slate-200 dark:border-[#21264b] pt-1.5 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Lương thực lĩnh (Net):
            </span>
            <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
              {Math.max(
                0,
                Math.round(
                  editingItem.hourly_rate * editingItem.working_hours +
                    (otRate <= 10
                      ? editingItem.total_overtime * editingItem.hourly_rate * otRate
                      : editingItem.total_overtime * otRate) -
                    (lateRate <= 10
                      ? editingItem.total_late_early * editingItem.hourly_rate * lateRate
                      : editingItem.total_late_early * lateRate) +
                    editingItem.allowance
                )
              ).toLocaleString('vi-VN')}{' '}
              ₫
            </span>
          </div>
        </div>

        {/* Explicit Confirm Button */}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Xác nhận cập nhật bảng lương</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
