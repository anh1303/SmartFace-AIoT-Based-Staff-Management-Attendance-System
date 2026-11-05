import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTheme } from '../../context/ThemeContext';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  /** Mảng dữ liệu các lát cắt của biểu đồ tròn */
  data: DonutSlice[];
  /** Bán kính vòng trong (mặc định 46) */
  innerRadius?: number;
  /** Bán kính vòng ngoài (mặc định 64) */
  outerRadius?: number;
  /** Góc hở giữa các lát cắt khi có từ 2 lát cắt trở lên (mặc định 3 độ) */
  paddingAngle?: number;
  /** Kích thước container biểu đồ (mặc định 'w-36 h-36') */
  sizeClassName?: string;
  /** Nội dung tùy biến hiển thị ở tâm vòng tròn */
  centerContent?: React.ReactNode;
  /** Văn bản khi không có dữ liệu nào > 0 (mặc định 'Chưa có dữ liệu') */
  fallbackText?: string;
  /** Màu của vòng tròn khi không có dữ liệu */
  fallbackColor?: string;
  /** Tùy biến nội dung tooltip */
  tooltipFormatter?: (val: any, name: any, item: any) => [string, string];
  /** ClassName bổ sung cho thẻ bọc ngoài */
  className?: string;
}

/**
 * Component Biểu đồ tròn DonutChart độc lập, tái sử dụng toàn hệ thống.
 * - Tự động triệt tiêu khe hở (paddingAngle = 0, stroke = none) khi đạt 100% hoặc chỉ có 1 nhóm dữ liệu để vòng tròn luôn khép kín tuyệt đối.
 * - Tự động đồng bộ viền stroke theo màu nền Dark/Light mode để các khe phân cắt sắc nét, không bị viền trắng thô cứng.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  innerRadius = 46,
  outerRadius = 64,
  paddingAngle = 3,
  sizeClassName = 'w-36 h-36',
  centerContent,
  fallbackText = 'Chưa có dữ liệu',
  fallbackColor,
  tooltipFormatter,
  className = '',
}) => {
  const { isDark } = useTheme();

  // Lọc chỉ các lát cắt có giá trị > 0
  const activeSlices = (data || []).filter((item) => Number(item.value) > 0);

  // Dữ liệu thực tế truyền vào Pie
  const chartData =
    activeSlices.length > 0
      ? activeSlices
      : [
          {
            name: fallbackText,
            value: 1,
            color: fallbackColor || (isDark ? '#21264b' : '#e2e8f0'),
          },
        ];

  // Chỉ bật khoảng cách paddingAngle và stroke khi có từ 2 lát cắt trở lên
  const hasMultipleSlices = activeSlices.length > 1;
  const effectivePaddingAngle = hasMultipleSlices ? paddingAngle : 0;
  const strokeColor = hasMultipleSlices ? (isDark ? '#13162b' : '#ffffff') : 'none';
  const strokeWidth = hasMultipleSlices ? 2 : 0;

  return (
    <div className={`relative ${sizeClassName} mx-auto ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={effectivePaddingAngle}
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            isAnimationActive={true}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${entry.name}-${index}`}
                fill={entry.color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#0f1224' : '#ffffff',
              borderColor: isDark ? '#21264b' : '#e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
              color: isDark ? '#ffffff' : '#0f172a',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
            formatter={tooltipFormatter}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Nội dung trung tâm */}
      {centerContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {centerContent}
        </div>
      )}
    </div>
  );
};

export default DonutChart;
