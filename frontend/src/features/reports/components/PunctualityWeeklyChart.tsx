import React from 'react';
import { Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export interface PunctualityWeekItem {
  week: string;
  rate: number;
  count: number;
  onTimeCount: number;
}

interface PunctualityWeeklyChartProps {
  punctualityData: PunctualityWeekItem[];
  hasPunctualityData: boolean;
}

export const PunctualityWeeklyChart: React.FC<PunctualityWeeklyChartProps> = ({
  punctualityData,
  hasPunctualityData,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
            Tỷ Lệ Đúng Giờ 4 Tuần Gần Nhất
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi tỷ lệ phần trăm lượt chấm công đúng giờ theo từng tuần
          </p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <Award className="w-4 h-4" />
        </div>
      </div>

      <div className="h-56 w-full">
        {!hasPunctualityData ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Chưa có đủ dữ liệu chấm công trong các tuần gần đây
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={punctualityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip
                formatter={(val: any, _name: any, item: any) => [
                  `${val}% (${item.payload.onTimeCount}/${item.payload.count} lượt)`,
                  'Đúng giờ',
                ]}
                contentStyle={{
                  backgroundColor: '#13162b',
                  borderColor: '#21264b',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="rate" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
