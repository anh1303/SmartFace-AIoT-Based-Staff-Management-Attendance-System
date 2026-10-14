import React from 'react';

export const ScheduleLegend: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 shadow-xs">
      <div className="flex items-center gap-4">
        <span className="text-slate-900 dark:text-white font-semibold">Chú thích loại ca:</span>
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300">
          <span className="w-2.5 h-2.5 rounded bg-blue-500" /> Ca Sáng (08:30 - 17:30)
        </span>
        <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
          <span className="w-2.5 h-2.5 rounded bg-purple-500" /> Hành Chính (08:00 - 17:30)
        </span>
        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
          <span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Ca Chiều (13:00 - 21:30)
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700" /> Nghỉ ca (OFF)
        </span>
      </div>
      <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">Bấm vào ô để sửa hoặc phân bổ ca</span>
    </div>
  );
};
