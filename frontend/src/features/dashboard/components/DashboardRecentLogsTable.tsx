import React from 'react';
import { Briefcase } from 'lucide-react';
import { AttendanceEventBadge } from '../../../components/common/AttendanceEventBadge';
import { formatVNTime } from '../../../utils/dateUtils';
import type { DashboardRecentLog } from '../api/dashboardApi';

interface DashboardRecentLogsTableProps {
  logs: DashboardRecentLog[];
}

export const DashboardRecentLogsTable: React.FC<DashboardRecentLogsTableProps> = ({ logs }) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs transition-colors h-full">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-4 h-4 text-blue-500" />
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          Nhật ký chấm công hôm nay
        </h3>
      </div>

      <div className="max-h-[310px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-100 dark:border-[#1d2243]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3">Nhân viên</th>
              <th className="py-2.5 px-3 text-center">Sự kiện</th>
              <th className="py-2.5 px-3 text-center">Thời điểm</th>
              <th className="py-2.5 px-3 text-center">Thiết bị</th>
              <th className="py-2.5 px-3 text-center">Độ tin cậy</th>
              <th className="py-2.5 px-3 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Chưa có lượt quẹt thẻ nào hôm nay.
                </td>
              </tr>
            ) : (
              logs.map((att) => {
                const initials = (att.employee_name || att.employee_id)
                  .split(' ')
                  .map((w: string) => w[0])
                  .slice(-2)
                  .join('');

                return (
                  <tr
                    key={att.attendance_id}
                    className="hover:bg-slate-50/50 dark:hover:bg-[#171b36]/60 transition-colors"
                  >
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-[#1f254b] text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0 overflow-hidden">
                          {att.avatar ? (
                            <img
                              src={att.avatar}
                              alt={att.employee_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {att.employee_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {att.employee_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <AttendanceEventBadge type={att.type} />
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300 font-medium">
                      {formatVNTime(att.timestamp)}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {att.device_id || '—'}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium">
                        {att.verification_score !== null &&
                        att.verification_score !== undefined
                          ? `${(att.verification_score * (att.verification_score > 1 ? 1 : 100)).toFixed(1)}%`
                          : '--'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${att.statusInfo.style}`}
                      >
                        {att.statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
