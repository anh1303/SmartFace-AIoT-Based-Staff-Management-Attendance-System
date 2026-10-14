import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Calendar,
  Search,
  ChevronDown
} from 'lucide-react';
import { formatDateToYYYYMMDD } from '../utils/scheduleUtils';

interface ScheduleWeekNavigatorProps {
  currentMonday: Date;
  weekNumber: number;
  startLabel: string;
  endLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoCurrentWeek: () => void;
  onDateSelect: (dateString: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (dept: string) => void;
}

export const ScheduleWeekNavigator: React.FC<ScheduleWeekNavigatorProps> = ({
  currentMonday,
  weekNumber,
  startLabel,
  endLabel,
  onPrevWeek,
  onNextWeek,
  onGoCurrentWeek,
  onDateSelect,
  searchTerm,
  setSearchTerm,
  departmentFilter,
  setDepartmentFilter,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
      {/* Week Selector + Today shortcut */}
      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
        {/* Solar Calendar Week Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] px-3 py-1.5 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={onPrevWeek}
            title="Tuần trước"
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative flex items-center gap-1.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-semibold px-2 cursor-pointer group" title="Bấm để chọn tuần theo lịch dương">
            <CalendarRange className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
            <span>TUẦN {weekNumber} ({startLabel} - {endLabel})</span>
            <input
              type="date"
              value={formatDateToYYYYMMDD(currentMonday)}
              onChange={e => onDateSelect(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          <button
            type="button"
            onClick={onNextWeek}
            title="Tuần sau"
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Today Button */}
        <button
          type="button"
          onClick={onGoCurrentWeek}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
          title="Nhảy nhanh về tuần hiện tại"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Hôm nay</span>
        </button>
      </div>

      {/* Search & Position Filters */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        {/* Search by Employee */}
        <div className="relative flex-1 md:w-64">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tên, mã NV, chức vụ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Position / Department Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            Chức vụ:
          </span>
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-[#13162b]">Tất cả chức vụ</option>
              <option value="Bảo vệ" className="bg-white dark:bg-[#13162b]">Bảo vệ</option>
              <option value="Nhân viên" className="bg-white dark:bg-[#13162b]">Nhân viên</option>
              <option value="Thu ngân" className="bg-white dark:bg-[#13162b]">Thu ngân</option>
              <option value="Quản lý" className="bg-white dark:bg-[#13162b]">Quản lý</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
