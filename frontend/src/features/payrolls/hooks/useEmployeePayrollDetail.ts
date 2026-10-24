import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Employee, PayrollRecord } from '../../../types';
import { calcPayrollAmount } from '../../../utils/payrollUtils';

export interface UseEmployeePayrollDetailOptions {
  currentEmp: Employee | null;
  workDays?: number;
  lateCount?: number;
}

/**
 * Feature Hook: Quản lý chi tiết lịch sử bảng lương, kỳ hiện tại và tính toán thu nhập nhân viên.
 */
export function useEmployeePayrollDetail(options: UseEmployeePayrollDetailOptions) {
  const { currentEmp, workDays = 0, lateCount = 0 } = options;
  const { payroll, bonusPenalty } = useApp();

  // 1. Employee Payroll Records
  const employeePayrolls = useMemo(() => {
    if (!currentEmp) return [];
    return payroll
      .filter((p) => p.employee_id === currentEmp.employee_id || p.employee_id === currentEmp.id)
      .sort((a, b) => {
        const periodA = a.period || a.payroll_period || '';
        const periodB = b.period || b.payroll_period || '';
        return periodB.localeCompare(periodA);
      });
  }, [payroll, currentEmp]);

  // 2. Current Month Payroll Estimation
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentPeriodKey = `${currentYear}-${currentMonth}`;

  const currentMonthPayroll = useMemo(() => {
    return employeePayrolls.find((p) => (p.period || p.payroll_period) === currentPeriodKey) || employeePayrolls[0] || null;
  }, [employeePayrolls, currentPeriodKey]);

  // Dùng đơn giá snapshot của phiếu trong preview nếu có, thay vì lấy cấu hình mới áp lên phiếu cũ
  const hourlyRate = currentMonthPayroll?.hourly_rate !== undefined && currentMonthPayroll?.hourly_rate !== null
    ? Number(currentMonthPayroll.hourly_rate)
    : (currentEmp?.hourly_rate || 0);

  const standardHours = currentMonthPayroll?.total_working_hours ?? currentMonthPayroll?.working_hours ?? (workDays * 8 || 0);
  const overtimeHours = currentMonthPayroll?.total_overtime ?? 0;
  const lateEarlyHours = currentMonthPayroll?.total_late_early ?? (lateCount * 0.5);
  const allowance = currentMonthPayroll?.allowance ?? 0;

  const otRate = currentMonthPayroll?.overtime_rate !== undefined && currentMonthPayroll?.overtime_rate !== null
    ? Number(currentMonthPayroll.overtime_rate)
    : (bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5);

  const penaltyRate = currentMonthPayroll?.late_early_penalty !== undefined && currentMonthPayroll?.late_early_penalty !== null
    ? Number(currentMonthPayroll.late_early_penalty)
    : (bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000);

  const otAmount = calcPayrollAmount(overtimeHours, otRate, hourlyRate);
  const penaltyAmount = calcPayrollAmount(lateEarlyHours, penaltyRate, hourlyRate);

  const baseSalary = standardHours * hourlyRate;
  const currentNetSalary = currentMonthPayroll?.net_salary
    ? Number(currentMonthPayroll.net_salary)
    : Math.max(0, Math.round(baseSalary + otAmount - penaltyAmount + allowance));

  const pastPayrolls = employeePayrolls;

  return {
    employeePayrolls,
    currentMonthPayroll,
    hourlyRate,
    standardHours,
    overtimeHours,
    lateEarlyHours,
    allowance,
    currentNetSalary,
    pastPayrolls,
    currentPeriodKey,
    baseSalary,
    otAmount,
    penaltyAmount,
    otRate,
    penaltyRate,
  };
}
