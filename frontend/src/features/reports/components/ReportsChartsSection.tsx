import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

export interface PayrollTrendPoint {
  period: string;
  cost: number;
}

export interface PunctualityWeekItem {
  week: string;
  rate: number;
  count: number;
  onTimeCount: number;
}

interface ReportsChartsSectionProps {
  payrollTrendData: PayrollTrendPoint[];
  punctualityData: PunctualityWeekItem[];
  hasPunctualityData: boolean;
}

export const ReportsChartsSection: React.FC<ReportsChartsSectionProps> = ({
  payrollTrendData,
  punctualityData,
  hasPunctualityData,
}) => {
  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Payroll Expense Trend */}
      <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Chi phí quỹ lương theo kỳ (Triệu VNĐ)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng ngân sách chi trả thực tế các kỳ
            </p>
          </div>
          <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
            {payrollTrendData.length} kỳ lương
          </span>
        </div>

        {payrollTrendData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13162b',
                    borderColor: '#21264b',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="cost" name="Quỹ lương (Triệu ₫)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            <FileSpreadsheet className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
            <span>Chưa có dữ liệu</span>
          </div>
        )}
      </div>

      {/* Punctuality Rate Area Chart */}
      <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Tỷ lệ đi làm đúng giờ theo tuần (%)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đo lường mức độ tuân thủ nội quy (4 tuần gần nhất)
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            Thời gian thực
          </span>
        </div>

        {hasPunctualityData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={punctualityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="punctualityColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13162b',
                    borderColor: '#21264b',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(val: unknown, _name: unknown, item: { payload?: { count?: number } }) => [
                    (item?.payload?.count ?? 0) > 0 ? `${val}%` : 'Chưa có dữ liệu',
                    'Tỷ lệ đúng giờ',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  name="Tỷ lệ đúng giờ"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#punctualityColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            <FileSpreadsheet className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
            <span>Chưa có dữ liệu</span>
          </div>
        )}
      </div>
    </div>
  );
};
