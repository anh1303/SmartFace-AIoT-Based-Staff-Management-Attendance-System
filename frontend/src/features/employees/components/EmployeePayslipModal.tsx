import React from 'react';
import { CreditCard, Printer } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { PayrollRecord, Employee } from '../../../types';

interface EmployeePayslipModalProps {
  payslip: PayrollRecord | null;
  onClose: () => void;
  currentEmp: Employee;
  hourlyRate: number;
  otRate: number;
  penaltyRate: number;
}

export const EmployeePayslipModal: React.FC<EmployeePayslipModalProps> = ({
  payslip,
  onClose,
  currentEmp,
  hourlyRate,
  otRate,
  penaltyRate,
}) => {
  if (!payslip) return null;

  const slipHourly = Number(payslip.hourly_rate || hourlyRate);
  const slipWorking = Number(payslip.total_working_hours ?? payslip.working_hours ?? 160);
  const slipOT = Number(payslip.total_overtime ?? 0);
  const slipLate = Number(payslip.total_late_early ?? 0);
  const slipOTAmount = otRate <= 10 ? slipOT * slipHourly * otRate : slipOT * otRate;
  const slipLateAmount = penaltyRate <= 10 ? slipLate * slipHourly * penaltyRate : slipLate * penaltyRate;
  const slipAllowance = Number(payslip.allowance ?? 0);
  const slipBase = slipWorking * slipHourly;

  return (
    <Modal
      isOpen={Boolean(payslip)}
      onClose={onClose}
      title={`Phiếu Lương Chi Tiết - Kỳ ${payslip.period || payslip.payroll_period}`}
      subtitle="Hệ thống tự động tính lương theo CSDL chuẩn AIoT"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Header Info */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              {currentEmp.full_name} ({currentEmp.employee_id})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentEmp.department} • {currentEmp.position}
            </p>
          </div>
          <span
            className={`text-xs font-mono px-3 py-1 rounded-lg border font-medium ${payslip.status !== 'PENDING'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
              : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50'
              }`}
          >
            {payslip.status !== 'PENDING' ? 'ĐÃ CHỐT' : 'CHỜ DUYỆT'}
          </span>
        </div>

        {/* Payslip Lines */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
            <span className="text-slate-500 dark:text-slate-400">Lương theo giờ (Hourly Rate):</span>
            <span className="font-mono text-slate-900 dark:text-white font-semibold">
              {slipHourly.toLocaleString('vi-VN')} ₫/h
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
            <span className="text-slate-500 dark:text-slate-400">Lương cơ bản ({slipWorking} giờ làm):</span>
            <span className="font-mono text-slate-900 dark:text-white font-semibold">
              {slipBase.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
            <span className="text-slate-500 dark:text-slate-400">Thưởng tăng ca ({slipOT}h OT):</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              +{slipOTAmount.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
            <span className="text-slate-500 dark:text-slate-400">Phạt trễ/sớm ({slipLate}h):</span>
            <span className={`font-mono font-semibold ${slipLateAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
              {slipLateAmount > 0 ? `-${slipLateAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#21264b]">
            <span className="text-slate-500 dark:text-slate-400">Phụ cấp chức vụ (Allowance):</span>
            <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
              +{slipAllowance.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="flex justify-between py-3 border-t border-slate-100 dark:border-[#21264b] text-sm">
            <span className="font-bold text-slate-900 dark:text-white">THỰC LĨNH (NET SALARY):</span>
            <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-base">
              {Number(payslip.net_salary ?? 0).toLocaleString('vi-VN')} ₫
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>Số tài khoản và tiền lương tự động được chuyển khoản định kỳ.</span>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#21264b]">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In phiếu lương</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors shadow-sm shadow-purple-600/20 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
