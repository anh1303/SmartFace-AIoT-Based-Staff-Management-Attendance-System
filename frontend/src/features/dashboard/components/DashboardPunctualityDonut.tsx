import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DonutChart } from '../../../components/common';
import type { DashboardPunctuality } from '../api/dashboardApi';

interface DashboardPunctualityDonutProps {
  punctuality: DashboardPunctuality;
  workingEmployeesCount: number;
}

export const DashboardPunctualityDonut: React.FC<DashboardPunctualityDonutProps> = ({
  punctuality,
  workingEmployeesCount,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors h-full">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Tình hình chấm công hôm nay
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
          {/* Biểu đồ Donut độc lập, tái sử dụng */}
          <DonutChart
            data={punctuality.donutData}
            innerRadius={46}
            outerRadius={64}
            paddingAngle={3}
            centerContent={
              <>
                <span className="text-xl font-black font-mono text-slate-900 dark:text-white leading-none">
                  {workingEmployeesCount}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                  Nhân viên
                </span>
              </>
            }
          />

          {/* Stats breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                Đúng giờ({punctuality.onTimeCount})
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {punctuality.onTimePct}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                Đi muộn / về sớm({punctuality.lateCount})
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {punctuality.latePct}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                Chưa check-in({punctuality.notCheckedInCount})
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {punctuality.notCheckedInPct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
