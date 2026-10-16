import React from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

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
    <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
      {/* Ambient Floating & Morphing Blurred Blobs */}
      <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
            Quản Lý Danh Sách Nhân Sự
          </h1>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3">
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
      </div>
    </div>
  );
};
