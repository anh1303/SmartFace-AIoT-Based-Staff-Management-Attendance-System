import { ActionButton } from '@/components/common/ActionFeedback';
import React from 'react';
import { Modal } from '../../../components/common/Modal';
import type { Employee } from '../types';

interface ConfirmDeleteEmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
  onConfirmDelete: (emp: Employee) => void;
}

export const ConfirmDeleteEmployeeModal: React.FC<ConfirmDeleteEmployeeModalProps> = ({
  employee,
  onClose,
  onConfirmDelete,
}) => {
  if (!employee) return null;

  return (
    <Modal
      isOpen={Boolean(employee)}
      onClose={onClose}
      title="Xác nhận xóa nhân viên"
      subtitle={`Nhân viên: ${employee.full_name} (${employee.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-3">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Toàn bộ dữ liệu hồ sơ nhân viên sẽ bị xóa vĩnh viễn.
          </p>
          <div className="space-y-2 font-bold">
            <p className="text-rose-600 dark:text-rose-400">
              • Chỉ xóa cứng được khi nhân viên mới tạo nhầm (chưa có dữ liệu chấm công/lương).
            </p>
            <p className="text-amber-700 dark:text-amber-400">
              • Nếu nhân viên đã phát sinh công/lương, hệ thống sẽ từ chối xóa để đảm bảo đối chiếu khi cần — hãy sử dụng tính năng Đổi trạng thái sang Tạm ngưng.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <ActionButton busyLabel="Đang xóa…"
            type="button"
            onClick={() => onConfirmDelete(employee)}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Xác nhận xóa vĩnh viễn</span>
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
};

interface ConfirmStatusEmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
  onConfirmToggle: (emp: Employee) => void;
}

export const ConfirmStatusEmployeeModal: React.FC<ConfirmStatusEmployeeModalProps> = ({
  employee,
  onClose,
  onConfirmToggle,
}) => {
  if (!employee) return null;

  return (
    <Modal
      isOpen={Boolean(employee)}
      onClose={onClose}
      title="Xác nhận thay đổi trạng thái nhân viên"
      subtitle={`Nhân viên: ${employee.full_name} (${employee.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#21264b] text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p className="font-semibold text-slate-900 dark:text-white">
            Bạn có chắc chắn muốn chuyển trạng thái nhân viên này?
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Trạng thái hiện tại:{' '}
            <strong
              className={
                employee.status === 'ACTIVE'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500'
              }
            >
              {employee.status === 'ACTIVE' ? 'Hoạt động' : 'TẠM NGƯNG'}
            </strong>{' '}
            ➔ Chuyển thành:{' '}
            <strong
              className={
                employee.status === 'ACTIVE'
                  ? 'text-slate-500'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
            >
              {employee.status === 'ACTIVE' ? 'TẠM NGƯNG' : 'Hoạt động'}
            </strong>
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Hủy bỏ
          </button>
          <ActionButton busyLabel={employee.status === 'ACTIVE' ? 'Đang vô hiệu hóa…' : 'Đang kích hoạt…'}
            type="button"
            onClick={() => onConfirmToggle(employee)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Xác nhận thay đổi
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
};
