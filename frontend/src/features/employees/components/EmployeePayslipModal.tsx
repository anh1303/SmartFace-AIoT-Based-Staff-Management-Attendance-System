import React from 'react';
import { CreditCard, Printer } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { PayrollRecord, Employee } from '../../../types';
import { PayslipBreakdown } from '../../payrolls/components/PayslipBreakdown';
import { calcPayrollAmount } from '../../../utils/payrollUtils';

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

  // Ưu tiên đơn giá snapshot lưu trong phiếu nếu có, thay vì cấu hình mới áp lên phiếu cũ
  const slipHourly = payslip.hourly_rate !== undefined && payslip.hourly_rate !== null
    ? Number(payslip.hourly_rate)
    : Number(hourlyRate || 0);

  const effectiveOtRate = payslip.overtime_rate !== undefined && payslip.overtime_rate !== null
    ? Number(payslip.overtime_rate)
    : otRate;

  const effectivePenaltyRate = payslip.late_penalty_rate !== undefined && payslip.late_penalty_rate !== null
    ? Number(payslip.late_penalty_rate)
    : penaltyRate;

  const slipWorking = Number(payslip.total_working_hours ?? payslip.working_hours ?? 0);
  const slipOT = Number(payslip.total_overtime ?? 0);
  const slipLate = Number(payslip.total_late_early ?? 0);
  const slipOTAmount = calcPayrollAmount(slipOT, effectiveOtRate, slipHourly);
  const slipLateAmount = calcPayrollAmount(slipLate, effectivePenaltyRate, slipHourly);
  const slipAllowance = Number(payslip.allowance ?? 0);
  const slipBase = slipWorking * slipHourly;

  return (
    <Modal
      isOpen={Boolean(payslip)}
      onClose={onClose}
      title={`Phiếu Lương Chi Tiết - Kỳ ${payslip.period || payslip.payroll_period}`}
      subtitle="Đối chiếu thu nhập, phụ cấp và các khoản đã duyệt."
      maxWidth="2xl"
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
            className={`text-xs font-mono px-3 py-1 rounded-lg border font-medium ${
              payslip.status === 'PAID'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
                : payslip.status === 'FINALIZED'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50'
                : payslip.status === 'CONFIRMED'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50'
                : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50'
            }`}
          >
            {payslip.status === 'PAID'
              ? 'ĐÃ THANH TOÁN'
              : payslip.status === 'FINALIZED'
              ? 'ĐÃ CHỐT'
              : payslip.status === 'CONFIRMED'
              ? 'ĐÃ XÁC NHẬN'
              : 'CHỜ DUYỆT'}
          </span>
        </div>

        <PayslipBreakdown record={payslip} otRate={otRate} penaltyRate={penaltyRate}/>

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
            className="px-4 py-2 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm shadow-blue-600/20 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
