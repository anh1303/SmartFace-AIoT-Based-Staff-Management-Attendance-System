import React from 'react';
import { Clock, Sun, Sunset, Briefcase } from 'lucide-react';
import type { DashboardShiftGroup } from '../api/dashboardApi';

interface DashboardTodayShiftsProps {
  shifts: DashboardShiftGroup[];
}

export const DashboardTodayShifts: React.FC<DashboardTodayShiftsProps> = ({ shifts }) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors h-full">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Ca làm việc hôm nay
          </h3>
        </div>

        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#181c38]/60 border border-slate-200/60 dark:border-[#272d5a] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  {shift.type === 'MORNING' ? (
                    <Sun className="w-4 h-4" />
                  ) : shift.type === 'AFTERNOON' ? (
                    <Sunset className="w-4 h-4" />
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
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${shift.liveStatus.style}`}
                >
                  {shift.liveStatus.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {shift.count} nhân viên
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
