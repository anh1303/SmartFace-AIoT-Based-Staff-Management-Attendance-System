import React from 'react';
import { Copy, Layers } from 'lucide-react';

interface ScheduleHeaderProps {
  onCopyPreviousWeek: () => void;
  onOpenBulkModal: () => void;
}

export const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({
  onCopyPreviousWeek,
  onOpenBulkModal,
}) => {
  return (
    <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
      {/* Ambient Floating & Morphing Blurred Blobs */}
      <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
          Sắp Xếp & Phân Bổ Ca Làm Việc
        </h1>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3">
        {/* Copy from previous week */}
        <button
          type="button"
          onClick={onCopyPreviousWeek}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#272d5a] transition-colors shadow-xs cursor-pointer"
          title="Sao chép toàn bộ ca từ tuần trước sang tuần này"
        >
          <Copy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Sao chép tuần trước</span>
        </button>

        {/* Bulk Assign Button */}
        <button
          type="button"
          onClick={onOpenBulkModal}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>⚡ Phân ca nhanh hàng loạt</span>
        </button>
      </div>
    </div>
  );
};
