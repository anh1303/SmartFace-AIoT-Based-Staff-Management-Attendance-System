import React from 'react';
import { Calendar } from 'lucide-react';

interface ReportsDateToolbarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onSelectToday: () => void;
  isTodaySelected: boolean;
  isSameDay: boolean;
  totalAttendanceCount: number;
}

export const ReportsDateToolbar: React.FC<ReportsDateToolbarProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSelectToday,
  isTodaySelected,
  isSameDay,
  totalAttendanceCount,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
      {/* Date Range Pickers: Từ ngày - Đến ngày */}
      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
        {/* Từ ngày */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Từ ngày:
          </span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs hidden sm:inline">
          -
        </span>

        {/* Đến ngày */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Đến ngày:
          </span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Nút Hôm nay */}
        <button
          type="button"
          onClick={onSelectToday}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isTodaySelected
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#272d5a]'
          }`}
        >
          Hôm nay
        </button>
      </div>

      {/* Thông tin thống kê theo khoảng ngày */}
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {isSameDay ? `Ngày: ${startDate}` : `Khoảng: ${startDate} → ${endDate}`}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">
            {totalAttendanceCount} lượt chấm công
          </span>
        </div>
      </div>
    </div>
  );
};
