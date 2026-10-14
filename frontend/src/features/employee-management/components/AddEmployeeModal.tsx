import React from 'react';
import { Modal } from '../../../components/common/Modal';

export interface NewEmployeeFormState {
  employee_id: string;
  full_name: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  face_enrolled: boolean;
  fingerprint_enrolled: boolean;
  hourly_rate: number;
  avatar: string;
}

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  newEmp: NewEmployeeFormState;
  onChangeNewEmp: React.Dispatch<React.SetStateAction<NewEmployeeFormState>>;
  positionOptions: string[];
  onSubmit: (e: React.FormEvent) => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  newEmp,
  onChangeNewEmp,
  positionOptions,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm nhân viên mới vào hệ thống"
      subtitle="Thông tin sẽ được đồng bộ ngay vào máy quét khuôn mặt AIoT"
      maxWidth="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mã nhân viên (ID)
            </label>
            <input
              type="text"
              required
              readOnly
              value={newEmp.employee_id}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-[#0f1224]/60 border border-slate-200 dark:border-[#21264b] rounded-xl text-xs text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed select-none focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Hoàng Minh Trí"
              value={newEmp.full_name}
              onChange={(e) => onChangeNewEmp({ ...newEmp, full_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức vụ
            </label>
            <select
              value={newEmp.department}
              onChange={(e) => onChangeNewEmp({ ...newEmp, department: e.target.value })}
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
              Chức danh / Vị trí
            </label>
            <input
              type="text"
              required
              value={newEmp.position}
              onChange={(e) => onChangeNewEmp({ ...newEmp, position: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email doanh nghiệp
            </label>
            <input
              type="email"
              required
              placeholder="tri.hoang@company.com"
              value={newEmp.email}
              onChange={(e) => onChangeNewEmp({ ...newEmp, email: e.target.value })}
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
              placeholder="0912.345.678"
              value={newEmp.phone}
              onChange={(e) => onChangeNewEmp({ ...newEmp, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lương theo giờ (VNĐ)
            </label>
            <input
              type="number"
              required
              step="1000"
              min="1000"
              placeholder="50000"
              value={newEmp.hourly_rate}
              onChange={(e) => onChangeNewEmp({ ...newEmp, hourly_rate: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181c38] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xs transition-all cursor-pointer"
          >
            Lưu nhân viên mới
          </button>
        </div>
      </form>
    </Modal>
  );
};
