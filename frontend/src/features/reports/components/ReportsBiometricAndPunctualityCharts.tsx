import { ScanFace, Fingerprint, TrendingUp } from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { DonutChart } from '../../../components/common';

export interface MethodConfidenceStats {
  totalCount: number;
  pctOfTotal: number;
  tierGt95: number;
  tierMid: number;
  tierLt80: number;
}

export interface DailyPunctualityPoint {
  day: string;
  rate?: number;
  total: number;
  onTime: number;
}

interface ReportsBiometricAndPunctualityChartsProps {
  faceStats: MethodConfidenceStats;
  fpStats: MethodConfidenceStats;
  dailyPunctualityData: DailyPunctualityPoint[];
  selectedPeriod: string;
}

export const ReportsBiometricAndPunctualityCharts: React.FC<ReportsBiometricAndPunctualityChartsProps> = ({
  faceStats,
  fpStats,
  dailyPunctualityData,
  selectedPeriod,
}) => {
  const [yearStr, monthStr] = selectedPeriod.split('-');

  // Data for Face Donut
  const faceDonutData = [
    { name: '>= 95%', value: faceStats.tierGt95, color: '#10b981' },
    { name: '>= 80%', value: faceStats.tierMid, color: '#f59e0b' },
    { name: '< 80%', value: faceStats.tierLt80, color: '#f43f5e' },
  ];

  // Data for Fingerprint Donut
  const fpDonutData = [
    { name: '>= 95%', value: fpStats.tierGt95, color: '#10b981' },
    { name: '>= 80%', value: fpStats.tierMid, color: '#f59e0b' },
    { name: '< 80%', value: fpStats.tierLt80, color: '#f43f5e' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* CỘT TRÁI: Phương thức chấm công (chỉ 2 phương thức: Khuôn mặt và Vân tay) */}
      <div className="lg:col-span-6 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-[#1d2243]">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <ScanFace className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Phương thức chấm công
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Donut 1: Khuôn mặt */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#161a35]/60 border border-slate-200/60 dark:border-[#242b58] flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ScanFace className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Khuôn mặt (Face ID)
                </span>
              </div>

              {/* Chart container */}
              <DonutChart
                data={faceDonutData}
                innerRadius={46}
                outerRadius={64}
                paddingAngle={3}
                sizeClassName="w-36 h-36 my-1"
                fallbackText="Chưa có lượt"
                fallbackColor="#334155"
                tooltipFormatter={(val: any, name: any) => [
                  `${val} lượt (${faceStats.totalCount > 0 ? ((Number(val) / faceStats.totalCount) * 100).toFixed(1) : 0}%)`,
                  `Độ tin cậy ${name}`,
                ]}
                centerContent={
                  <>
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                        {faceStats.totalCount.toLocaleString('vi-VN')}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-sans">
                        lượt
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                      ({faceStats.pctOfTotal}%)
                    </span>
                  </>
                }
              />

              {/* 3 Categories Legend */}
              <div className="w-full space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-[#242b58] text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    &gt;= 95%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {faceStats.tierGt95}{' '}
                    <span className="text-slate-400 font-normal">
                      ({faceStats.totalCount > 0 ? Math.round((faceStats.tierGt95 / faceStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    &gt;= 80%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {faceStats.tierMid}{' '}
                    <span className="text-slate-400 font-normal">
                      ({faceStats.totalCount > 0 ? Math.round((faceStats.tierMid / faceStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    &lt; 80%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {faceStats.tierLt80}{' '}
                    <span className="text-slate-400 font-normal">
                      ({faceStats.totalCount > 0 ? Math.round((faceStats.tierLt80 / faceStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Donut 2: Vân tay */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#161a35]/60 border border-slate-200/60 dark:border-[#242b58] flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Fingerprint className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Vân tay (Fingerprint)
                </span>
              </div>

              {/* Chart container */}
              <DonutChart
                data={fpDonutData}
                innerRadius={46}
                outerRadius={64}
                paddingAngle={3}
                sizeClassName="w-36 h-36 my-1"
                fallbackText="Chưa có lượt"
                fallbackColor="#334155"
                tooltipFormatter={(val: any, name: any) => [
                  `${val} lượt (${fpStats.totalCount > 0 ? ((Number(val) / fpStats.totalCount) * 100).toFixed(1) : 0}%)`,
                  `Độ tin cậy ${name}`,
                ]}
                centerContent={
                  <>
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                        {fpStats.totalCount.toLocaleString('vi-VN')}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-sans">
                        lượt
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      ({fpStats.pctOfTotal}%)
                    </span>
                  </>
                }
              />

              {/* 3 Categories Legend */}
              <div className="w-full space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-[#242b58] text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    &gt;= 95%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {fpStats.tierGt95}{' '}
                    <span className="text-slate-400 font-normal">
                      ({fpStats.totalCount > 0 ? Math.round((fpStats.tierGt95 / fpStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    &gt;= 80%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {fpStats.tierMid}{' '}
                    <span className="text-slate-400 font-normal">
                      ({fpStats.totalCount > 0 ? Math.round((fpStats.tierMid / fpStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    &lt; 80%
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                    {fpStats.tierLt80}{' '}
                    <span className="text-slate-400 font-normal">
                      ({fpStats.totalCount > 0 ? Math.round((fpStats.tierLt80 / fpStats.totalCount) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: Biểu đồ tỉ lệ đúng giờ theo ngày */}
      <div className="lg:col-span-6 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-[#1d2243]">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Tỷ lệ đúng giờ theo ngày
          </h3>
        </div>

        <div className="h-[250px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyPunctualityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21264b" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1224',
                  borderColor: '#272d5a',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#fff',
                }}
                formatter={(val: any, _name: any, item: any) => [
                  `${val}% (${item?.payload?.onTime || 0}/${item?.payload?.total || 0} ngày công đúng giờ)`,
                  'Tỷ lệ đúng giờ',
                ]}
                labelFormatter={(label) => `Ngày ${label}/${monthStr}/${yearStr}`}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#38bdf8"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRate)"
                dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1.5, stroke: '#0f1224' }}
                activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
