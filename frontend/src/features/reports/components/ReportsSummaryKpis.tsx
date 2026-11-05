import React from 'react';
import {
  Building2,
  Users,
  CalendarCheck,
  Clock,
  AlertTriangle,
  UserX,
  CheckCircle2,
  Banknote,
} from 'lucide-react';

export interface ReportsSummaryKpisData {
  departmentCount: number;
  employeeCount: number;
  totalShiftsCount: number;
  totalOvertimeHours: number;
  totalLateEarlyHours: number;
  unexcusedAbsenceCount: number;
  onTimePunches: number;
  totalPunches: number;
  onTimeRate: number;
  totalSalary: number;
  selectedPeriod: string;
}

interface ReportsSummaryKpisProps {
  data: ReportsSummaryKpisData;
  hideDepartments?: boolean;
}

export const ReportsSummaryKpis: React.FC<ReportsSummaryKpisProps> = ({ data, hideDepartments = false }) => {
  const kpis = [
    {
      id: 'departments',
      title: 'Phòng ban',
      value: data.departmentCount,
      unit: '',
      icon: Building2,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'employees',
      title: 'Nhân viên',
      value: data.employeeCount,
      unit: '',
      icon: Users,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'shifts',
      title: 'Tổng số ca',
      value: data.totalShiftsCount.toLocaleString('vi-VN'),
      unit: 'ca',
      icon: CalendarCheck,
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'overtime',
      title: 'Tăng ca',
      value: data.totalOvertimeHours.toFixed(1),
      unit: 'giờ',
      icon: Clock,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'late-early',
      title: 'Đi muộn / Về sớm',
      value: data.totalLateEarlyHours.toFixed(1),
      unit: 'giờ',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
    {
      id: 'absent',
      title: 'Nghỉ làm không lý do',
      value: data.unexcusedAbsenceCount,
      unit: 'ca',
      icon: UserX,
      iconBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
    {
      id: 'ontime-rate',
      title: 'Tỉ lệ đúng giờ',
      value: data.totalPunches > 0 ? `${data.onTimeRate.toFixed(1)}%` : '—',
      unit: '',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'salary',
      title: 'Tổng lương',
      value: data.totalSalary >= 1000000000
        ? `${(data.totalSalary / 1000000000).toFixed(2)} tỷ`
        : data.totalSalary >= 1000000
          ? `${(data.totalSalary / 1000000).toFixed(1)} tr`
          : `${data.totalSalary.toLocaleString('vi-VN')} ₫`,
      fullValue: `${data.totalSalary.toLocaleString('vi-VN')} ₫`,
      unit: '',
      icon: Banknote,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 ${hideDepartments ? 'lg:grid-cols-7' : 'lg:grid-cols-8'} gap-3`}>
      {kpis.filter(kpi => !hideDepartments || kpi.id !== 'departments').map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.id}
            className="group relative overflow-hidden bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-3 flex flex-col justify-between shadow-xs hover:border-blue-400/50 dark:hover:border-blue-500/40 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate"
                title={kpi.title}
              >
                {kpi.title}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline gap-1" title={(kpi as any).fullValue || undefined}>
              <span className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {kpi.value}
              </span>
              {kpi.unit && (
                <span className="text-[11px] font-medium text-slate-400">
                  {kpi.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
