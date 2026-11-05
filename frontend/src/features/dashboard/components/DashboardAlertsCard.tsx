import React from 'react';
import { ShieldAlert, AlertTriangle, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardAlerts } from '../api/dashboardApi';

interface DashboardAlertsCardProps {
  alerts: DashboardAlerts;
}

export const DashboardAlertsCard: React.FC<DashboardAlertsCardProps> = ({ alerts }) => {
  const navigate = useNavigate();
  const { overdueEmployees, upcomingShiftNotice } = alerts;

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors h-full">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Chú ý
          </h3>
        </div>

        <div className="space-y-3">
          {overdueEmployees.length > 0 && (
            <div
              onClick={() => navigate('/app/manager/attendance')}
              className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {overdueEmployees.length} nhân viên chưa check-in
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-mono truncate">
                    {overdueEmployees.slice(0, 4).join(', ') +
                      (overdueEmployees.length > 4 ? '...' : '')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0 self-center" />
              </div>
            </div>
          )}

          {upcomingShiftNotice && (
            <div
              onClick={() => navigate('/app/manager/schedule')}
              className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    {upcomingShiftNotice.name} sắp bắt đầu
                  </p>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                    Bắt đầu lúc {upcomingShiftNotice.time} (còn{' '}
                    {upcomingShiftNotice.minutesLeft} phút)
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0 self-center" />
              </div>
            </div>
          )}

          {overdueEmployees.length === 0 && !upcomingShiftNotice && (
            <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-[#181c38]/40 border border-slate-200/60 dark:border-[#272d5a] text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 text-center py-6">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Không có cảnh báo nào cần xử lý lúc này</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
