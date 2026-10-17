import React from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common';

interface EmployeeListHeaderProps {
  onOpenPositionModal: () => void;
  onOpenAddModal: () => void;
}

export const EmployeeListHeader: React.FC<EmployeeListHeaderProps> = ({
  onOpenPositionModal,
  onOpenAddModal,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <PageHeaderBanner
      title="Quản Lý Danh Sách Nhân Sự"
      actions={
        <>
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenPositionModal}
              className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 dark:bg-[#181c38]/90 dark:hover:bg-[#20254b] dark:text-slate-200 border border-purple-200/80 dark:border-[#272d5a] backdrop-blur-sm text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Quản lý chức vụ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>
        </>
      }
    />
  );
};
