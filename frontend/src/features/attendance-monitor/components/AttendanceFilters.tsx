import React from 'react';
import {
  CheckCircle2,
  Lock,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import { getTodayVNString } from '../../../utils/dateUtils';

interface AttendanceFiltersProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  isCurrentDateLocked: boolean;
  onToggleLock: () => void;
  onExportCSV: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  selectedDate,
  setSelectedDate,
  isCurrentDateLocked,
  onToggleLock,
  onExportCSV,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
}) => {
  const handlePrevDay = () => {
    const [y, m, d] = (selectedDate || getTodayVNString()).split('-').map(Number);
    const dateObj = new Date(y, m - 1, d - 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleNextDay = () => {
    const [y, m, d] = (selectedDate || getTodayVNString()).split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  return (
    <div className="space-y-6">
      {/* Bento Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight flex items-center gap-2">
            Giám Sát Chấm Công Toàn Doanh Nghiệp
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dữ liệu điểm danh trực tiếp từ các thiết bị AI Edge Camera và cổng xoay an ninh.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleLock}
            disabled={selectedDate === ''}
            title={selectedDate === '' ? 'Vui lòng chọn 1 ngày cụ thể để chốt ca' : ''}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              selectedDate === ''
                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : isCurrentDateLocked
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm cursor-pointer'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 shadow-sm cursor-pointer'
            }`}
          >
            {isCurrentDateLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã chốt ca ({selectedDate})</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Chốt ca {selectedDate === getTodayVNString() ? 'hôm nay' : selectedDate ? selectedDate : ''}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={!isCurrentDateLocked}
            title={!isCurrentDateLocked ? 'Nút chỉ bật sau khi đã chốt ca ngày đang chọn' : 'Xuất dữ liệu chấm công sang file CSV/Excel'}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isCurrentDateLocked
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 cursor-pointer'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(getTodayVNString())}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedDate === getTodayVNString()
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Hôm nay
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã NV, chức vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ON_TIME">Đúng giờ</option>
              <option value="LATE">Đi muộn</option>
              <option value="EARLY_LEAVE">Về sớm</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
