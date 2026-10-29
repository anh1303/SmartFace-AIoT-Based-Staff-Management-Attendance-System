import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Employee } from '../../../types';

export interface UseEmployeePayrollDetailOptions {
  currentEmp: Employee | null;
  workDays?: number;
  lateCount?: number;
}

export function useEmployeePayrollDetail({ currentEmp }: UseEmployeePayrollDetailOptions) {
  const { payroll } = useApp();
  const employeePayrolls = useMemo(() => {
    if (!currentEmp) return [];
    return payroll
      .filter(p => p.employee_id === currentEmp.employee_id || p.employee_id === currentEmp.id)
      .sort((a, b) => (b.period || b.payroll_period || '').localeCompare(a.period || a.payroll_period || ''));
  }, [payroll, currentEmp]);
  const today = new Date();
  const currentPeriodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthPayroll = employeePayrolls.find(p => (p.period || p.payroll_period) === currentPeriodKey) ?? null;
  const breakdown = currentMonthPayroll?.breakdown;

  return {
    employeePayrolls,
    currentMonthPayroll,
    hourlyRate: Number(currentMonthPayroll?.hourly_rate ?? currentEmp?.hourly_rate ?? 0),
    standardHours: currentMonthPayroll?.total_working_hours ?? currentMonthPayroll?.working_hours ?? 0,
    overtimeHours: currentMonthPayroll?.total_overtime ?? 0,
    lateEarlyHours: currentMonthPayroll?.total_late_early ?? 0,
    allowance: currentMonthPayroll?.allowance ?? 0,
    currentNetSalary: currentMonthPayroll ? Number(currentMonthPayroll.net_salary) : null,
    pastPayrolls: employeePayrolls,
    currentPeriodKey,
    baseSalary: breakdown?.base_salary ?? null,
    otAmount: breakdown?.overtime_pay ?? null,
    penaltyAmount: breakdown ? breakdown.late_early_deduction + breakdown.absence_deduction : null,
    otRate: Number(currentMonthPayroll?.overtime_rate ?? 0),
    penaltyRate: Number(currentMonthPayroll?.late_penalty_rate ?? 0),
  };
}
