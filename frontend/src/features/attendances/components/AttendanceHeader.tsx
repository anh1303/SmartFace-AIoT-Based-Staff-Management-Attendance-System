import React from 'react';
import {
  CheckCircle2,
  Lock,
  Download,
} from 'lucide-react';
import { getTodayVNString } from '../../../utils/dateUtils';
import { useAuth } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common';

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
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isSameDay = startDate === endDate;

  const canClickLock = isAdmin && Boolean(startDate);

  return (
    <PageHeaderBanner
      title={isAdmin ? 'Giám sát chấm công toàn doanh nghiệp' : 'Giám sát chấm công phòng ban'}
      actions={
        <>
          {isAdmin && <button
            type="button"
            onClick={() => {
              if (canClickLock) {
                onToggleLock();
              }
            }}
            disabled={!canClickLock}
            title={
              !startDate
                ? 'Vui lòng chọn ngày để chốt ca'
                : isCurrentDateLocked && !isAdmin
                ? 'Chỉ Quản trị viên (Admin) mới có quyền mở khóa ca làm việc đã chốt'
                : isCurrentDateLocked
                ? 'Bấm để mở khóa chỉnh sửa dữ liệu công'
                : 'Bấm để chốt ca làm việc'
            }
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              !startDate
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
                : isCurrentDateLocked
                ? isAdmin
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 shadow-xs cursor-pointer'
                  : 'bg-emerald-50/70 dark:bg-emerald-500/5 text-emerald-700/80 dark:text-emerald-400/80 border border-emerald-200/60 dark:border-emerald-500/20 cursor-not-allowed'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 shadow-xs cursor-pointer'
            }`}
          >
            {isCurrentDateLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isAdmin
                    ? `Đã chốt ca (${isSameDay ? startDate : `${startDate} → ${endDate}`}) - Mở khóa`
                    : `Đã chốt ca (${isSameDay ? startDate : `${startDate} → ${endDate}`})`}
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  Chốt ca {isSameDay ? (startDate === getTodayVNString() ? 'hôm nay' : startDate) : `${startDate} → ${endDate}`}
                </span>
              </>
            )}
          </button>}

          <button
            type="button"
            onClick={onExportCSV}
            disabled={!isCurrentDateLocked}
            title={!isCurrentDateLocked ? 'Nút chỉ bật sau khi đã chốt ca' : 'Xuất dữ liệu chấm công sang file CSV/Excel'}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isCurrentDateLocked
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        </>
      }
    />
  );
};
