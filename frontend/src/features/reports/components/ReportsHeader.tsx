import React from 'react';
import { Download } from 'lucide-react';

interface ReportsHeaderProps {
  onOpenExportModal: () => void;
}

export const ReportsHeader: React.FC<ReportsHeaderProps> = ({ onOpenExportModal }) => {
  return (
    <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
      {/* Ambient Floating & Morphing Blurred Blobs */}
      <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
          Báo Cáo & Thống Kê Chuyên Cần
        </h1>
      </div>

      <button
        type="button"
        onClick={onOpenExportModal}
        className="relative z-10 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>Xuất báo cáo CSV</span>
      </button>
    </div>
  );
};
