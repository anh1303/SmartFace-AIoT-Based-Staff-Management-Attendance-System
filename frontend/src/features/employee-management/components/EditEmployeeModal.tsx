import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Employee } from '../../../types';

interface EditEmployeeModalProps {
  editEmployee: Employee | null;
  onClose: () => void;
  onChangeEditEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  positionOptions: string[];
  onSubmit: (e: React.FormEvent) => void;
  onTriggerDelete: (emp: Employee) => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  editEmployee,
  onClose,
  onChangeEditEmployee,
  positionOptions,
  onSubmit,
  onTriggerDelete,
}) => {
  if (!editEmployee) return null;

  return (
    <Modal
      isOpen={Boolean(editEmployee)}
      onClose={onClose}
      title={`Chỉnh sửa thông tin: ${editEmployee.full_name}`}
      subtitle={`Mã nhân viên: ${editEmployee.employee_id}`}
      maxWidth="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              required
              value={editEmployee.full_name}
              onChange={(e) =>
                onChangeEditEmployee({ ...editEmployee, full_name: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức vụ
            </label>
            <select
              value={editEmployee.department}
              onChange={(e) =>
                onChangeEditEmployee({ ...editEmployee, department: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-purple-500"
            >
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức danh
            </label>
            <input
              type="text"
              required
              value={editEmployee.position}
              onChange={(e) =>
                onChangeEditEmployee({ ...editEmployee, position: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lương theo giờ (VNĐ)
            </label>
            <input
              type="number"
              required
              step="1000"
              min="1000"
              value={editEmployee.hourly_rate}
              onChange={(e) =>
                onChangeEditEmployee({
                  ...editEmployee,
                  hourly_rate: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={editEmployee.email}
              onChange={(e) =>
                onChangeEditEmployee({ ...editEmployee, email: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Số điện thoại
            </label>
            <input
              type="text"
              required
              value={editEmployee.phone}
              onChange={(e) =>
                onChangeEditEmployee({ ...editEmployee, phone: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181c38] transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => onTriggerDelete(editEmployee)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-600/20 dark:hover:bg-rose-600 dark:text-rose-300 dark:hover:text-white dark:border-rose-500/30 transition-all cursor-pointer"
          >
            Xóa nhân viên
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xs transition-all cursor-pointer"
          >
            Xác nhận cập nhật thông tin
          </button>
        </div>
      </form>
    </Modal>
  );
};
