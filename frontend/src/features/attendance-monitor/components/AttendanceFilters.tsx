import React from 'react';
import {
  CheckCircle2,
  Lock,
  Download,
  Calendar,
  Search,
  ChevronDown,
} from 'lucide-react';
import { getTodayVNString } from '../../../utils/dateUtils';

interface AttendanceFiltersProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  isCurrentDateLocked: boolean;
  onToggleLock: () => void;
  onExportCSV: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isCurrentDateLocked,
  onToggleLock,
  onExportCSV,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
}) => {
  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    setStartDate(newStart);
    // Logic tránh chọn ngày bắt đầu lớn hơn ngày kết thúc
    if (endDate && newStart > endDate) {
      setEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndDate(newEnd);
    // Logic tránh chọn ngày kết thúc nhỏ hơn ngày bắt đầu
    if (startDate && newEnd < startDate) {
      setStartDate(newEnd);
    }
  };

  const handleSelectToday = () => {
    const today = getTodayVNString();
    setStartDate(today);
    setEndDate(today);
  };

  const isTodaySelected = startDate === getTodayVNString() && endDate === getTodayVNString();
  const isSameDay = startDate === endDate;

  return (
    <div className="space-y-6">
      {/* Bento Header with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight flex items-center gap-2">
            Giám Sát Chấm Công Toàn Doanh Nghiệp
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Dữ liệu điểm danh trực tiếp từ các thiết bị AI Edge Camera và cổng xoay an ninh.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleLock}
            disabled={!startDate}
            title={!startDate ? 'Vui lòng chọn ngày để chốt ca' : ''}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${!startDate
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
                : isCurrentDateLocked
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 shadow-xs cursor-pointer'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 shadow-xs cursor-pointer'
              }`}
          >
            {isCurrentDateLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Đã chốt ca ({isSameDay ? startDate : `${startDate} → ${endDate}`})</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  Chốt ca {isSameDay ? (startDate === getTodayVNString() ? 'hôm nay' : startDate) : `${startDate} → ${endDate}`}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={!isCurrentDateLocked}
            title={!isCurrentDateLocked ? 'Nút chỉ bật sau khi đã chốt ca' : 'Xuất dữ liệu chấm công sang file CSV/Excel'}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${isCurrentDateLocked
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs hover:from-purple-500 hover:to-indigo-500 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
              }`}
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range & Filter Controls */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs transition-colors">
        {/* Date Range Pickers: Từ ngày - Đến ngày */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Từ ngày */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition-colors">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Từ ngày:</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs hidden sm:inline">-</span>

          {/* Đến ngày */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition-colors">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Đến ngày:</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Nút Hôm nay */}
          <button
            type="button"
            onClick={handleSelectToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isTodaySelected
                ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                : 'bg-slate-100 dark:bg-[#181c38] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#272d5a]'
              }`}
          >
            Hôm nay
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã NV, chức vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              Chức vụ:
            </span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ON_TIME">Đúng giờ</option>
                <option value="LATE">Đi muộn</option>
                <option value="EARLY_LEAVE">Về sớm</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

