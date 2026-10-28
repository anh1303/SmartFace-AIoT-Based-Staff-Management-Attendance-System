import React from 'react';
import { ScanFace } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface MethodBreakdownItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface EmployeeAttendanceStat {
  id: string;
  name: string;
  dept: string;
  position: string;
  totalPunches: number;
  onTimePunches: number;
  latePunches: number;
  rate: string;
  rateNum: number;
  onTime: string;
  badge: string;
}

interface ReportsBreakdownAndLeaderboardProps {
  methodBreakdown: MethodBreakdownItem[];
  totalLogs: number;
  empStats: EmployeeAttendanceStat[];
}

export const ReportsBreakdownAndLeaderboard: React.FC<ReportsBreakdownAndLeaderboardProps> = ({
  methodBreakdown,
  totalLogs,
  empStats,
}) => {
  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Method breakdown with Larger Outer Radius (85) and Percentage Legend */}
      <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] space-y-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Cơ cấu phương thức chấm công
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tỷ lệ nhận diện khuôn mặt Face ID so với các phương thức khác
          </p>
        </div>

        {totalLogs > 0 ? (
          <>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {methodBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#13162b',
                      borderColor: '#21264b',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val}% (${item?.payload?.count || 0} lượt)`,
                      item?.payload?.name || name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Clear Legend with Percentage and Exact Punch Count */}
            <div className="space-y-2 text-xs pt-1">
              {methodBreakdown.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] hover:border-blue-300 dark:hover:border-blue-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {m.value}%
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                      ({m.count} lượt)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-56 w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            <ScanFace className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
            <span>Chưa có dữ liệu chấm công</span>
          </div>
        )}
      </div>

      {/* Attendance Leaderboard */}
      <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Bảng Xếp Hạng Chuyên Cần Nhân Sự
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đánh giá tỷ lệ đúng giờ và chấp hành ca trực
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Đánh giá KPI CSDL
          </span>
        </div>

        <div className="space-y-3">
          {empStats.length > 0 ? (
            empStats.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                      idx === 0
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                        : idx === 1
                        ? 'bg-slate-200 dark:bg-slate-700/20 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700/40'
                        : 'bg-slate-100 dark:bg-[#13162b] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#21264b]'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.dept} • {item.onTime}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {item.rate}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                      item.badge === 'XUẤT SẮC'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : item.badge === 'TỐT'
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                        : item.badge === 'CẦN LƯU Ý'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              Chưa có dữ liệu nhân sự
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
