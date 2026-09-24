import React from 'react';
import { useApp } from '../../context/AppContext';
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
  const currentPayroll = payroll.find(p => p.employee_id === empCode && (p.period === '2026-09' || !p.period)) 
    || payroll.find(p => p.employee_id === empCode)
    || payroll[0];

  const hourlyRate = currentEmp?.hourly_rate || currentPayroll?.hourly_rate || 120000;
  const overtimeHours = currentPayroll?.total_overtime ?? 4.0;
  const lateEarlyHours = currentPayroll?.total_late_early ?? 0;
  const allowance = currentPayroll?.allowance ?? 2500000;
  const otRate = bonusPenalty?.overtime_rate || 100000;
  const penaltyRate = bonusPenalty?.late_early_penalty || 50000;

  const otAmount = overtimeHours * otRate;
  const penaltyAmount = lateEarlyHours * penaltyRate;
  const standardHours = 160; // 20 ngày x 8h
  const baseSalary = standardHours * hourlyRate;
  const netSalary = currentPayroll?.net_salary 
    ? Number(currentPayroll.net_salary)
    : (baseSalary + otAmount - penaltyAmount + allowance);

  // Attended days count
  const myAttendance = attendance.filter(a => a.employee_id === empCode);
  const distinctDays = Array.from(new Set(myAttendance.map(a => a.timestamp.slice(0, 10)))).length;
  const workDaysCount = distinctDays > 0 ? distinctDays : 19;
  const progressPercent = Math.min(100, Math.round((workDaysCount / 22) * 100));

  return (
    <div className="space-y-6">
      {/* Bento Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Lương Tạm Tính ({currentPayroll?.period ? `Kỳ ${currentPayroll.period}` : 'Tháng 09/2026'})
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono font-medium border border-amber-500/20">
              {currentPayroll?.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'ĐANG TÍCH LŨY CÔNG'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Số liệu tự động tính toán từ ca làm việc, giờ quẹt thẻ và chính sách thưởng/phạt CSDL.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>CHỈ ĐỌC • MINH BẠCH CSDL</span>
        </div>
      </div>

      {/* Hero Bento Salary Metric Card */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ước tính thực lĩnh đến hiện tại (Net Salary)
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-white tracking-tight">
              {netSalary.toLocaleString('vi-VN')} <span className="text-2xl text-blue-400 font-normal">₫</span>
            </div>
            <p className="text-xs text-slate-400">
              Mức lương theo giờ: <strong>{hourlyRate.toLocaleString('vi-VN')} ₫/h</strong> • Đã tích lũy <strong>{overtimeHours}h OT</strong>.
            </p>
          </div>

          <div className="md:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Tiến độ tích lũy ngày công</span>
              <span className="font-mono text-blue-400 font-bold">{workDaysCount} / 22 ngày ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Đơn giá OT: {otRate.toLocaleString('vi-VN')} ₫/h</span>
              <span>Đơn giá phạt: {penaltyRate.toLocaleString('vi-VN')} ₫/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Earnings Breakdown */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white font-heading">
            Chi tiết các khoản thu nhập (Thu nhập chuẩn CSDL)
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Lương theo giờ tiêu chuẩn ca</p>
                <p className="text-[11px] text-slate-400">{hourlyRate.toLocaleString('vi-VN')} ₫/h × 160h định mức</p>
              </div>
              <span className="font-mono text-xs font-bold text-white">{baseSalary.toLocaleString('vi-VN')} ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Thưởng tăng ca (Overtime)</p>
                <p className="text-[11px] text-slate-400">{overtimeHours}h OT × {otRate.toLocaleString('vi-VN')} ₫/h</p>
              </div>
              <span className="font-mono text-xs font-bold text-green-400">+ {otAmount.toLocaleString('vi-VN')} ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Khoản phụ cấp (Allowance)</p>
                <p className="text-[11px] text-slate-400">Phụ cấp chức vụ & trách nhiệm</p>
              </div>
              <span className="font-mono text-xs font-bold text-green-500">+ {allowance.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white font-heading">
            Khấu trừ & Quy tắc phạt CSDL
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Phạt đi muộn / về sớm</p>
                <p className="text-[11px] text-slate-400">{lateEarlyHours}h vi phạm × {penaltyRate.toLocaleString('vi-VN')} ₫/h</p>
              </div>
              <span className={`font-mono text-xs font-bold ${penaltyAmount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {penaltyAmount > 0 ? `- ${penaltyAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
              </span>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1.5">
              <p className="font-bold text-blue-400">Công thức tính:</p>
              <p className="font-mono text-[11px] text-slate-300">
                Thực nhận = (Lương giờ × Tổng giờ ca) + (OT × Mức thưởng OT) - (Đi muộn/Về sớm × Mức phạt) + Phụ cấp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
