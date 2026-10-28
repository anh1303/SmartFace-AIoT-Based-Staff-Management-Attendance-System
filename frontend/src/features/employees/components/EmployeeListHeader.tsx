import { Settings, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common';

interface EmployeeListHeaderProps {
  onOpenDeptPositionDrawer?: () => void;
  onOpenPositionModal?: () => void;
  onOpenAddModal: () => void;
}

export const EmployeeListHeader: React.FC<EmployeeListHeaderProps> = ({
  onOpenDeptPositionDrawer,
  onOpenPositionModal,
  onOpenAddModal,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const handleOpenDrawer = onOpenDeptPositionDrawer || onOpenPositionModal;

  return (
    <PageHeaderBanner
      title="Quản Lý Danh Sách Nhân Sự"
      actions={
        <>
          {isAdmin && handleOpenDrawer && (
            <button
              type="button"
              onClick={handleOpenDrawer}
              className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 dark:bg-[#181c38]/90 dark:hover:bg-[#20254b] dark:text-slate-200 border border-blue-200/80 dark:border-[#272d5a] hover:border-blue-300 dark:hover:border-blue-500/50 backdrop-blur-sm text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer group"
              title="Quản lý danh mục phòng ban và chức vụ trên cơ sở dữ liệu"
            >
              <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:rotate-45 transition-transform duration-300" />
              <span>Quản lý phòng ban và chức vụ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>
        </>
      }
    />
  );
};

