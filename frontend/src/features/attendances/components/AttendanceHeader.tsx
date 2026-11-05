import React from 'react';
import {
  Unlock,
  Lock,
  Download,
  Clock,
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
  canLock?: boolean;
  canExport?: boolean;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  startDate,
  endDate,
  isCurrentDateLocked,
  onToggleLock,
  onExportCSV,
  canLock = true,
  canExport = isCurrentDateLocked,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isSameDay = startDate === endDate;

  const canClickLock = isAdmin && Boolean(startDate) && canLock;

  return (
    <PageHeaderBanner
      className="[&>div:first-child]:items-center"
      icon={<div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner"><Clock className="w-5 h-5" /></div>}
      title="Giám sát chấm công"
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
              !canClickLock
                ? 'Cần có ca làm việc hôm nay và dữ liệu sẵn sàng để chốt ca'
                : isCurrentDateLocked && !isAdmin
                ? 'Chỉ Quản trị viên (Admin) mới có quyền mở khóa ca làm việc đã chốt'
                : isCurrentDateLocked
                ? 'Bấm để mở khóa chỉnh sửa dữ liệu công'
                : 'Bấm để chốt ca làm việc'
            }
            className={`h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              !canClickLock
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
                <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {`Mở khóa ngày (${isSameDay ? startDate : `${startDate} → ${endDate}`})`}
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
            disabled={!canExport}
            title={!canExport ? 'Chỉ xuất sau khi đã chốt ca và dữ liệu sẵn sàng' : 'Xuất dữ liệu chấm công sang file Excel (.xlsx)'}
            className={`h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              canExport
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </>
      }
    />
  );
};
