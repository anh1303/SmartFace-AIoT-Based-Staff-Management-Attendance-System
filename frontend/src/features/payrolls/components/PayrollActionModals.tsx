import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { AlertCircle } from 'lucide-react';

interface PayrollFinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  totalExpense: number;
  employeeCount?: number;
  staffCount?: number;
  onConfirm: () => void;
}

export const PayrollFinalizeModal: React.FC<PayrollFinalizeModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  totalExpense,
  employeeCount,
  staffCount,
  onConfirm,
}) => {
  const count = employeeCount ?? staffCount ?? 0;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận chốt bảng lương kỳ này?"
      subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
    >
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-bold">Lưu ý bảo mật:</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Sau khi chốt sổ, các phiếu thuộc quyền được chốt sẽ được khóa (read-only), nhân viên có thể xem
              phiếu lương chi tiết và kế toán sẽ tiến hành giải ngân qua ngân hàng.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-[#0f1224] rounded-xl border border-slate-200 dark:border-[#272d5a] text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Tổng ngân sách chi trả:</span>
            <span className="font-mono text-slate-900 dark:text-white font-bold">
              {totalExpense.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Số lượng nhân viên:</span>
            <span className="font-mono text-slate-900 dark:text-white">{count} người</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            Đồng ý chốt bảng lương
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface PayrollUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  onConfirm: () => void;
}

export const PayrollUnlockModal: React.FC<PayrollUnlockModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mở khóa chỉnh sửa bảng lương?"
      subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Bạn đang yêu cầu mở khóa bảng lương kỳ <strong>{selectedPeriod}</strong>. Trạng thái sẽ
          được chuyển về <strong>ĐANG SOẠN THẢO</strong> để cho phép chỉnh sửa số liệu.
        </p>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            Mở khóa chỉnh sửa
          </button>
        </div>
      </div>
    </Modal>
  );
};
