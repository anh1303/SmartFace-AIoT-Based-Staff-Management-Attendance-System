import React from 'react';
import { History } from 'lucide-react';
import { PayrollRecord } from '../../../types';

interface EmployeePayrollTabProps {
  currentPeriodKey?: string;
  currentMonthPayroll?: PayrollRecord | null;
  hourlyRate?: number;
  currentNetSalary?: number;
  baseSalary?: number;
  standardHours?: number;
  overtimeHours?: number;
  otAmount?: number;
  allowance?: number;
  lateEarlyHours?: number;
  penaltyAmount?: number;
  workDays?: number;
  otRate?: number;
  penaltyRate?: number;
  pastPayrolls: PayrollRecord[];
  onSelectPayslip: (p: PayrollRecord) => void;
}

export const EmployeePayrollTab: React.FC<EmployeePayrollTabProps> = ({
  hourlyRate = 100000,
  pastPayrolls,
  onSelectPayslip,
}) => {
  return (
    <div className="space-y-6">
      {/* Past Months Payroll Records Table */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="p-5 bg-slate-100 dark:bg-[#0c0f1f] border-b-2 border-slate-300 dark:border-[#28305c] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Lịch Sử Phiếu Lương
            </h3>
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {pastPayrolls.length} tháng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[850px]">
            <thead>
              <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4 w-[130px] border-r border-slate-300 dark:border-[#222956] text-center">Tháng</th>
                <th className="py-3.5 px-4 w-[130px] border-r border-slate-300 dark:border-[#222956] text-center">Lương theo giờ</th>
                <th className="py-3.5 px-4 w-[110px] border-r border-slate-300 dark:border-[#222956] text-center">Tổng giờ làm</th>
                <th className="py-3.5 px-4 w-[110px] border-r border-slate-300 dark:border-[#222956] text-center">Số giờ tăng ca</th>
                <th className="py-3.5 px-4 w-[140px] border-r border-slate-300 dark:border-[#222956] text-center">Số giờ đi trễ/về sớm</th>
                <th className="py-3.5 px-4 w-[120px] border-r border-slate-300 dark:border-[#222956] text-center">Phụ cấp</th>
                <th className="py-3.5 px-4 w-[130px] text-center">Thực lĩnh</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {pastPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Chưa có lịch sử bảng lương cho nhân viên này.
                  </td>
                </tr>
              ) : (
                pastPayrolls.map((p, idx) => {
                  const hourly = Number(p.hourly_rate || hourlyRate);
                  const working = Number(p.total_working_hours ?? p.working_hours ?? 160);
                  const ot = Number(p.total_overtime ?? 0);
                  const lateEarly = Number(p.total_late_early ?? 0);
                  const allw = Number(p.allowance ?? 0);
                  const net = Number(p.net_salary ?? 0);
                  const periodStr = p.period || p.payroll_period;

                  return (
                    <tr
                      key={p.payroll_id || idx}
                      onClick={() => onSelectPayslip(p)}
                      className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors cursor-pointer border-b border-slate-200 dark:border-[#202752]"
                      title="Nhấp để xem chi tiết phiếu lương"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752] truncate" title={periodStr}>
                        {periodStr}
                      </td>
                      <td className="py-3.5 px-4 font-mono border-r border-slate-200 dark:border-[#202752] truncate" title={`${hourly.toLocaleString('vi-VN')} ₫/h`}>
                        {hourly.toLocaleString('vi-VN')} ₫/h
                      </td>
                      <td className="py-3.5 px-4 font-mono border-r border-slate-200 dark:border-[#202752] truncate" title={`${working}h`}>
                        {working}h
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-[#202752] truncate" title={ot > 0 ? `+${ot}h` : '0h'}>
                        {ot > 0 ? `+${ot}h` : '0h'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-[#202752] truncate" title={lateEarly > 0 ? `${lateEarly}h` : '0h'}>
                        {lateEarly > 0 ? `${lateEarly}h` : '0h'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-purple-600 dark:text-purple-400 border-r border-slate-200 dark:border-[#202752] truncate" title={allw > 0 ? `+${allw.toLocaleString('vi-VN')} ₫` : '0 ₫'}>
                        {allw > 0 ? `+${allw.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 dark:text-white text-sm truncate" title={`${net.toLocaleString('vi-VN')} ₫`}>
                        {net.toLocaleString('vi-VN')} ₫
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
