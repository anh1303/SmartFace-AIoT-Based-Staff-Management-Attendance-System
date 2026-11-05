import React from 'react';
import { Clock, Sun, Sunset, Moon, Briefcase } from 'lucide-react';
import type { DashboardShiftGroup } from '../api/dashboardApi';

interface DashboardTodayShiftsProps {
  shifts: DashboardShiftGroup[];
}

const SHIFT_STATUS_CONFIG: Record<
  string,
  { label: string; style: string; isOngoing: boolean }
> = {
  ONGOING: {
    label: 'Đang diễn ra',
    style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    isOngoing: true,
  },
  UPCOMING: {
    label: 'Sắp diễn ra',
    style: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    isOngoing: false,
  },
  ENDED: {
    label: 'Đã kết thúc',
    style: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
    isOngoing: false,
  },
};

export const DashboardTodayShifts: React.FC<DashboardTodayShiftsProps> = ({ shifts }) => {
  const getStatusBadge = (liveStatus?: DashboardShiftGroup['liveStatus']) => {
    if (liveStatus?.code && SHIFT_STATUS_CONFIG[liveStatus.code]) {
      return SHIFT_STATUS_CONFIG[liveStatus.code];
    }
    if (liveStatus?.label === 'Đang diễn ra') {
      return SHIFT_STATUS_CONFIG.ONGOING;
    }
    return {
      label: liveStatus?.label || 'Chưa xác định',
      style: liveStatus?.style || 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
      isOngoing: false,
    };
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Ca làm việc hôm nay
            </h3>
          </div>
        </div>

        <div className="space-y-3 max-h-[276px] overflow-y-auto" tabIndex={shifts.length > 3 ? 0 : undefined}>
          {shifts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Chưa có ca làm việc nào được phân công hôm nay
            </div>
          ) : (
            shifts.map((shift) => {
              const statusBadge = getStatusBadge(shift.liveStatus);
              return (
                <div
                  key={shift.id}
                  className="min-h-[84px] p-3 rounded-xl bg-slate-50/80 dark:bg-[#181c38]/60 border border-slate-200/60 dark:border-[#272d5a] flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-[#383f7a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      {shift.type === 'MORNING' ? (
                        <Sun className="w-4 h-4" />
                      ) : shift.type === 'AFTERNOON' ? (
                        <Sunset className="w-4 h-4" />
                      ) : shift.type === 'NIGHT' ? (
                        <Moon className="w-4 h-4" />
                      ) : (
                        <Briefcase className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {shift.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {shift.timeRange}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.style}`}
                    >
                      {statusBadge.isOngoing && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {statusBadge.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {shift.count} nhân viên
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
