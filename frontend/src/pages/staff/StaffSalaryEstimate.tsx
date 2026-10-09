import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatVNDateISO } from '../../utils/dateUtils';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase
} from 'lucide-react';

export const StaffSalaryEstimate: React.FC = () => {
  const { currentUser, payroll, employees, bonusPenalty, attendance } = useApp();

  const empCode = currentUser?.employee_id || 'NV-001';
  const currentEmp = employees.find(e => e.employee_id === empCode);

  // Dynamic periods available for this staff member
  const myPayrolls = payroll.filter(p => p.employee_id === empCode);
  const availablePeriods = Array.from(
    new Set(myPayrolls.map(p => p.period || p.payroll_period).filter(Boolean) as string[])
  ).sort().reverse();

  const [selectedStaffPeriod, setSelectedStaffPeriod] = useState<string>(() => {
    return availablePeriods[0] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (availablePeriods.length > 0 && !availablePeriods.includes(selectedStaffPeriod)) {
      setSelectedStaffPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, selectedStaffPeriod]);

  const currentPayroll = myPayrolls.find(p => (p.period || p.payroll_period) === selectedStaffPeriod)
    || myPayrolls[0]
    || payroll.find(p => p.employee_id === empCode)
    || payroll[0];

  const hourlyRate = currentEmp?.hourly_rate || currentPayroll?.hourly_rate || 120000;
  const overtimeHours = currentPayroll?.total_overtime ?? 4.0;
  const lateEarlyHours = currentPayroll?.total_late_early ?? 0;
  const allowance = currentPayroll?.allowance ?? 2500000;
  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const penaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  // Bug 1 Fix: Handle multiplier vs fixed amount correctly
  const otAmount = otRate <= 10
    ? overtimeHours * hourlyRate * otRate
    : overtimeHours * otRate;

  const penaltyAmount = penaltyRate <= 10
    ? lateEarlyHours * hourlyRate * penaltyRate
    : lateEarlyHours * penaltyRate;

  const standardHours = currentPayroll?.total_working_hours || 160;
  const baseSalary = standardHours * hourlyRate;
  const netSalary = currentPayroll?.net_salary
    ? Number(currentPayroll.net_salary)
    : Math.max(0, Math.round(baseSalary + otAmount - penaltyAmount + allowance));

  // Attended days count
  const myAttendance = attendance.filter(a => a.employee_id === empCode);
  const distinctDays = Array.from(new Set(myAttendance.map(a => formatVNDateISO(a.timestamp)))).length;
  const workDaysCount = distinctDays > 0 ? distinctDays : 19;
  const progressPercent = Math.min(100, Math.round((workDaysCount / 22) * 100));

  const otRateLabel = otRate <= 10
    ? `${otRate}x lương giờ (${(otRate * hourlyRate).toLocaleString('vi-VN')} ₫/h)`
    : `${otRate.toLocaleString('vi-VN')} ₫/h`;

  const penaltyRateLabel = penaltyRate <= 10
    ? `${penaltyRate}x lương giờ (${(penaltyRate * hourlyRate).toLocaleString('vi-VN')} ₫/h)`
    : `${penaltyRate.toLocaleString('vi-VN')} ₫/h`;

  return (
    <div className="space-y-6">
      {/* Bento Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              Lương Tạm Tính ({selectedStaffPeriod ? `Kỳ ${selectedStaffPeriod}` : 'Kỳ hiện tại'})
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-medium border border-amber-500/20">
              {currentPayroll?.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'ĐANG TÍCH LŨY CÔNG'}
            </span>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {availablePeriods.length > 0 && (
            <div className="flex items-center gap-2 bg-white/80 dark:bg-[#0f1224] px-3 py-1.5 rounded-xl border border-purple-200/80 dark:border-[#272d5a] backdrop-blur-sm">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Kỳ lương:</span>
              <select
                value={selectedStaffPeriod}
                onChange={e => setSelectedStaffPeriod(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none cursor-pointer"
              >
                {availablePeriods.map(period => {
                  const [year, month] = period.split('-');
                  return (
                    <option key={period} value={period} className="bg-white dark:bg-[#13162b] text-slate-900 dark:text-white">
                      Tháng {month}/{year}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#0f1224] border border-purple-200/80 dark:border-[#272d5a] text-purple-600 dark:text-purple-400 text-xs font-mono backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>CHỈ ĐỌC • MINH BẠCH CSDL</span>
          </div>
        </div>
      </div>

      {/* Hero Bento Salary Metric Card with Continuous Shifting Gradient & Floating Blobs */}
      <div className="p-8 rounded-2xl bento-hero-gradient relative overflow-hidden transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-72 h-72 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/3 right-1/4 w-52 h-52 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 space-y-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ước tính thực lĩnh đến hiện tại (Net Salary)
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {netSalary.toLocaleString('vi-VN')} <span className="text-2xl text-purple-600 dark:text-purple-400 font-normal">₫</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mức lương theo giờ: <strong className="text-slate-900 dark:text-white">{hourlyRate.toLocaleString('vi-VN')} ₫/h</strong> • Đã tích lũy <strong className="text-slate-900 dark:text-white">{overtimeHours}h OT</strong> • Tổng giờ làm: <strong className="text-slate-900 dark:text-white">{standardHours}h</strong>.
            </p>
          </div>

          <div className="md:col-span-5 bg-white/80 dark:bg-[#0f1224] p-5 rounded-xl border border-purple-200/80 dark:border-[#272d5a] space-y-3 backdrop-blur-sm">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ tích lũy ngày công</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{workDaysCount} / 22 ngày ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#1a1e3a] h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800">
              <div
                className="bg-purple-600 h-full rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>Đơn giá OT: {otRate <= 10 ? `${otRate}x (${(otRate * hourlyRate).toLocaleString('vi-VN')} ₫/h)` : `${otRate.toLocaleString('vi-VN')} ₫/h`}</span>
              <span>Đơn giá phạt: {penaltyRate <= 10 ? `${penaltyRate}x` : `${penaltyRate.toLocaleString('vi-VN')} ₫/h`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Earnings Breakdown */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Chi tiết các khoản thu nhập (Thu nhập chuẩn CSDL)
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Lương theo giờ tiêu chuẩn ca</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{hourlyRate.toLocaleString('vi-VN')} ₫/h × {standardHours}h định mức</p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{baseSalary.toLocaleString('vi-VN')} ₫</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Thưởng tăng ca (Overtime)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{overtimeHours}h OT × {otRateLabel}</p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">+ {otAmount.toLocaleString('vi-VN')} ₫</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Khoản phụ cấp (Allowance)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Phụ cấp chức vụ & trách nhiệm</p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">+ {allowance.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Khấu trừ & Quy tắc phạt CSDL
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Phạt đi muộn / về sớm</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{lateEarlyHours}h vi phạm × {penaltyRateLabel}</p>
              </div>
              <span className={`font-mono text-xs font-bold ${penaltyAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                {penaltyAmount > 0 ? `- ${penaltyAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
              <p className="font-bold text-purple-600 dark:text-purple-400">Công thức tính:</p>
              <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                Thực nhận = (Lương giờ × Tổng giờ ca) + (OT × Mức thưởng OT) - (Đi muộn/Về sớm × Mức phạt) + Phụ cấp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};