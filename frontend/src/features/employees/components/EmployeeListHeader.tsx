import React from 'react';
import { Settings, Plus, Download, Users } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common';

export interface EmployeeListHeaderProps {
  onOpenDeptPositionDrawer?: () => void;
  onOpenPositionModal?: () => void;
  onOpenAddModal: () => void;
  onExportExcel?: () => void;
  canExport?: boolean;
}

export const EmployeeListHeader: React.FC<EmployeeListHeaderProps> = ({
  onOpenDeptPositionDrawer,
  onOpenPositionModal,
  onOpenAddModal,
  onExportExcel,
  canExport = true,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const handleOpenDrawer = onOpenDeptPositionDrawer || onOpenPositionModal;

  return (
    <PageHeaderBanner
      icon={
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
          <Users className="w-5 h-5" />
        </div>
      }
      title="Quản lý nhân viên"
      actions={
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* 1. Nút Quản lý phòng ban và chức vụ */}
          {isAdmin && handleOpenDrawer && (
            <button
              type="button"
              onClick={handleOpenDrawer}
              className="h-10 px-4 rounded-xl bg-white/80 hover:bg-white text-slate-700 dark:bg-[#181c38]/90 dark:hover:bg-[#20254b] dark:text-slate-200 border border-blue-200/80 dark:border-[#272d5a] hover:border-blue-300 dark:hover:border-blue-500/50 backdrop-blur-sm text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer group whitespace-nowrap"
              title="Quản lý danh mục phòng ban và chức vụ trên cơ sở dữ liệu"
            >
              <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:rotate-45 transition-transform duration-300" />
              <span>Quản lý phòng ban và chức vụ</span>
            </button>
          )}

          {/* 2. Nút Thêm nhân viên mới */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs shadow-blue-500/25 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>

          {/* 3. Nút Xuất Excel */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={!canExport}
              className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              title={canExport ? 'Xuất danh sách nhân sự sang file Excel (.xlsx)' : 'Không có dữ liệu nhân viên sẵn sàng để xuất'}
            >
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Xuất Excel</span>
            </button>
          )}
        </div>
      }
    />
  );
};

