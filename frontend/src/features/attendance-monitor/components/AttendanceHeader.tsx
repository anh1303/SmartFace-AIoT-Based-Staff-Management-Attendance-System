import React from 'react';
import {
  CheckCircle2,
  Lock,
  Download,
} from 'lucide-react';
import { getTodayVNString } from '../../../utils/dateUtils';

interface AttendanceHeaderProps {
  startDate: string;
  endDate: string;
  isCurrentDateLocked: boolean;
  onToggleLock: () => void;
  onExportCSV: () => void;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  startDate,
  endDate,
  isCurrentDateLocked,
  onToggleLock,
  onExportCSV,
}) => {
  const isSameDay = startDate === endDate;

  return (
    <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative overflow-hidden">
      {/* Ambient Floating & Morphing Blurred Blobs */}
      <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

      <div className="relative z-10">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight flex items-center gap-2">
          Giám Sát Chấm Công Toàn Doanh Nghiệp
        </h1>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleLock}
          disabled={!startDate}
          title={!startDate ? 'Vui lòng chọn ngày để chốt ca' : ''}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            !startDate
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
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            isCurrentDateLocked
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs hover:from-purple-500 hover:to-indigo-500 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Xuất Excel/CSV</span>
        </button>
      </div>
    </div>
  );
};
