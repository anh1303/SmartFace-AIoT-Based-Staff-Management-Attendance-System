import { AppError } from './AppError.js';

export interface SalaryCalculationInput {
  hourly_rate: number;
  total_working_hours: number;
  total_overtime: number;
  total_late_early: number;
  allowance: number;
  overtime_rate: number;
  late_early_penalty: number;
  total_absence_penalty?: number;
}

export interface PayrollBreakdown {
  base_salary: number;
  overtime_pay: number;
  late_early_deduction: number;
  absence_deduction: number;
  allowance: number;
  net_salary: number;
}

export function computePayrollBreakdown(params: SalaryCalculationInput): PayrollBreakdown {
  const { hourly_rate, total_working_hours, total_overtime, total_late_early,
    allowance, overtime_rate, late_early_penalty,
    total_absence_penalty = 0 } = params;

  if (![hourly_rate, total_working_hours, total_overtime, total_late_early,
    allowance, overtime_rate, late_early_penalty, total_absence_penalty]
    .every(value => Number.isFinite(value) && value >= 0)) {
    throw AppError.badRequest('Dữ liệu tính lương phải hữu hạn và không âm');
  }

  const base_salary = hourly_rate * total_working_hours;
  const overtime_pay = total_overtime * overtime_rate * hourly_rate;
  const late_early_deduction = total_late_early * late_early_penalty * hourly_rate;
  const net_salary = Math.max(0, Math.round(base_salary + overtime_pay - late_early_deduction - total_absence_penalty + allowance));
  if (![base_salary, overtime_pay, late_early_deduction, net_salary].every(Number.isFinite) || net_salary >= 1e13) {
    throw AppError.badRequest('Số tiền vượt giới hạn lưu trữ phiếu lương');
  }
  return { base_salary, overtime_pay, late_early_deduction, absence_deduction: total_absence_penalty, allowance, net_salary };
}
