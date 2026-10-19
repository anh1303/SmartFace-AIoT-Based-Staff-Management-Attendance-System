import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { AlertTriangle } from 'lucide-react';
import { Employee } from '../../../types';

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
      title="Xác nhận xóa vĩnh viễn nhân sự"
      subtitle={`Nhân sự: ${employee.full_name} (${employee.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>CẢNH BÁO: XÓA VĨNH VIỄN KHỎI CƠ SỞ DỮ LIỆU</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Nhân viên: <strong className="text-slate-900 dark:text-white">{employee.full_name}</strong>{' '}
            (Mã:{' '}
            <span className="font-mono text-purple-600 dark:text-purple-400">
              {employee.employee_id}
            </span>{' '}
            • Chức vụ: {employee.department})
          </p>
          <div className="space-y-1 text-[11px] text-rose-700 dark:text-rose-300/90 bg-rose-100/60 dark:bg-rose-950/60 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
            <p>
              • Toàn bộ dữ liệu hồ sơ, tài khoản đăng nhập, vector sinh trắc học Face ID, dữ liệu vân
              tay FAP30 và ca làm việc sẽ bị <strong>XÓA VĨNH VIỄN</strong> trên cơ sở dữ liệu.
            </p>
            <p className="text-rose-600 dark:text-rose-400 font-semibold">
              • Chỉ xóa cứng được khi nhân viên mới tạo nhầm (chưa có dữ liệu chấm công/lương).
            </p>
            <p className="text-amber-700 dark:text-amber-400 font-medium">
              • Nếu nhân viên đã phát sinh công/lương, hệ thống sẽ từ chối xóa để đảm bảo kiểm toán (Audit) — hãy sử dụng tính năng Đổi trạng thái sang Tạm ngưng/Đã nghỉ việc.
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
          <button
            type="button"
            onClick={() => onConfirmDelete(employee)}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Xác nhận xóa vĩnh viễn</span>
          </button>
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
      title="Xác nhận thay đổi trạng thái nhân sự"
      subtitle={`Nhân sự: ${employee.full_name} (${employee.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#21264b] text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p className="font-semibold text-slate-900 dark:text-white">
            Bạn có chắc chắn muốn chuyển trạng thái nhân sự này?
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
              {employee.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGƯNG'}
            </strong>{' '}
            ➔ Chuyển thành:{' '}
            <strong
              className={
                employee.status === 'ACTIVE'
                  ? 'text-slate-500'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
            >
              {employee.status === 'ACTIVE' ? 'TẠM NGƯNG' : 'ĐANG HOẠT ĐỘNG'}
            </strong>
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Khi tạm ngưng, quyền check-in tại các cổng camera AIoT và bảng tính công sẽ được điều
            chỉnh tương ứng.
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
          <button
            type="button"
            onClick={() => onConfirmToggle(employee)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Xác nhận thay đổi
          </button>
        </div>
      </div>
    </Modal>
  );
};
