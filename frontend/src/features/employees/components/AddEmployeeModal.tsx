import React, { useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrencyVND, parseCurrencyVND } from '../utils/employeeUtils';

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
  departmentOptions: string[];
  positionsByDepartment: (department: string) => string[];
  onSubmit: (e: React.FormEvent) => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  newEmp,
  onChangeNewEmp,
  departmentOptions,
  positionsByDepartment,
  onSubmit,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  // Lấy danh sách chức vụ thuộc phòng hiện tại đang được chọn
  const currentDept = newEmp.department || departmentOptions[0] || 'Nhân sự';
  const rawPositions = useMemo(() => {
    return positionsByDepartment ? positionsByDepartment(currentDept) : [];
  }, [positionsByDepartment, currentDept]);

  const availablePositions = useMemo(() => {
    return isAdmin
      ? rawPositions
      : rawPositions.filter((pos) => !/quản lý|manager|trưởng phòng|giám đốc/i.test(pos));
  }, [isAdmin, rawPositions]);

  // Xử lý khi chọn phòng khác -> tự động cập nhật vị trí sang chức vụ đầu tiên của phòng đó
  const handleDepartmentChange = (dept: string) => {
    const posList = positionsByDepartment ? positionsByDepartment(dept) : [];
    const filteredPos = isAdmin
      ? posList
      : posList.filter((pos) => !/quản lý|manager|trưởng phòng|giám đốc/i.test(pos));
    onChangeNewEmp((prev) => ({
      ...prev,
      department: dept,
      position: filteredPos[0] || posList[0] || '',
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm nhân viên mới"
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
              placeholder="Hoàng Minh Trí"
              value={newEmp.full_name}
              onChange={(e) => onChangeNewEmp({ ...newEmp, full_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phòng
            </label>
            <select
              value={newEmp.department}
              disabled={!isAdmin}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white ${!isAdmin ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800/50 opacity-70' : 'cursor-pointer'} focus:outline-none focus:border-blue-500`}
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức vụ
            </label>
            <select
              value={newEmp.position}
              onChange={(e) => onChangeNewEmp({ ...newEmp, position: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-blue-500"
            >
              {availablePositions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
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
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              required
              maxLength={10}
              placeholder="0912345678"
              value={newEmp.phone}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                onChangeNewEmp({ ...newEmp, phone: numericOnly });
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lương theo giờ (VNĐ)
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="50.000"
              value={formatCurrencyVND(newEmp.hourly_rate)}
              onChange={(e) => {
                const numeric = parseCurrencyVND(e.target.value);
                onChangeNewEmp({ ...newEmp, hourly_rate: numeric });
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
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
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs transition-all cursor-pointer"
          >
            Lưu nhân viên mới
          </button>
        </div>
      </form>
    </Modal>
  );
};
