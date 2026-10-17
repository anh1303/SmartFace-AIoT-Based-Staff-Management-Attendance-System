import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Employee, PayrollRecord, AttendanceRecord, WorkShift } from '../../../types';
import { formatVNDateISO } from '../../../utils/dateUtils';

export interface UseEmployeeDetailDataOptions {
  currentEmp: Employee | null;
  startDate?: string;
  endDate?: string;
  attendanceTypeFilter?: string;
  attendanceStatusFilter?: string;
}

export interface AttendanceStats {
  totalLogs: number;
  checkIns: number;
  checkOuts: number;
  workDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  avgConfidence: number;
}

export function useEmployeeDetailData(options: UseEmployeeDetailDataOptions) {
  const { currentEmp, startDate = '', endDate = '', attendanceTypeFilter = 'ALL', attendanceStatusFilter = 'ALL' } = options;
  const { attendance, payroll, bonusPenalty, workShifts } = useApp();

  // 1. Filtered Attendance Logs
  const employeeAttendanceLogs = useMemo(() => {
    if (!currentEmp) return [];
    return attendance
      .filter((record) => {
        if (record.employee_id !== currentEmp.employee_id && record.employee_id !== currentEmp.id) {
          return false;
        }
        const recordDate = formatVNDateISO(record.timestamp);
        if (startDate && recordDate < startDate) return false;
        if (endDate && recordDate > endDate) return false;
        if (attendanceTypeFilter === 'CHECK_IN' && record.type !== 'CHECK_IN') return false;
        if (attendanceTypeFilter === 'CHECK_OUT' && record.type !== 'CHECK_OUT' && record.type !== 'TAN_CA') return false;
        if (attendanceStatusFilter === 'ON_TIME' && record.punctuality !== 'ON_TIME') return false;
        if (attendanceStatusFilter === 'LATE' && record.punctuality !== 'LATE') return false;
        if (attendanceStatusFilter === 'EARLY_LEAVE' && record.punctuality !== 'EARLY_LEAVE') return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendance, currentEmp, startDate, endDate, attendanceTypeFilter, attendanceStatusFilter]);

  // 2. Attendance Statistics
  const attendanceStats = useMemo<AttendanceStats>(() => {
    if (!currentEmp) {
      return { totalLogs: 0, checkIns: 0, checkOuts: 0, workDays: 0, lateCount: 0, earlyLeaveCount: 0, avgConfidence: 0 };
    }
    const empLogs = attendance.filter((r) => {
      if (r.employee_id !== currentEmp.employee_id && r.employee_id !== currentEmp.id) return false;
      const rDate = formatVNDateISO(r.timestamp);
      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;
      return true;
    });

    const checkIns = empLogs.filter((r) => r.type === 'CHECK_IN').length;
    const checkOuts = empLogs.filter((r) => r.type === 'CHECK_OUT' || r.type === 'TAN_CA').length;
    const distinctDays = new Set(empLogs.map((r) => formatVNDateISO(r.timestamp))).size;
    const lateCount = empLogs.filter((r) => r.punctuality === 'LATE').length;
    const earlyLeaveCount = empLogs.filter((r) => r.punctuality === 'EARLY_LEAVE').length;

    const scores = empLogs.map((r) => Number(r.verification_score || 0.98)).filter((s) => s > 0);
    const avgConfidence = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 98.5;

    return {
      totalLogs: empLogs.length,
      checkIns,
      checkOuts,
      workDays: distinctDays,
      lateCount,
      earlyLeaveCount,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
    };
  }, [attendance, currentEmp, startDate, endDate]);

  // 3. Employee Payroll Records
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

  // 4. Current Month Payroll Estimation
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentPeriodKey = `${currentYear}-${currentMonth}`;

  const currentMonthPayroll = useMemo(() => {
    return employeePayrolls.find((p) => (p.period || p.payroll_period) === currentPeriodKey) || employeePayrolls[0] || null;
  }, [employeePayrolls, currentPeriodKey]);

  const hourlyRate = currentEmp?.hourly_rate || currentMonthPayroll?.hourly_rate || 100000;
  const standardHours = currentMonthPayroll?.total_working_hours ?? currentMonthPayroll?.working_hours ?? (attendanceStats.workDays * 8 || 160);
  const overtimeHours = currentMonthPayroll?.total_overtime ?? 4.0;
  const lateEarlyHours = currentMonthPayroll?.total_late_early ?? (attendanceStats.lateCount * 0.5);
  const allowance = currentMonthPayroll?.allowance ?? 2000000;

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const penaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const otAmount = otRate <= 10
    ? overtimeHours * hourlyRate * otRate
    : overtimeHours * otRate;

  const penaltyAmount = penaltyRate <= 10
    ? lateEarlyHours * hourlyRate * penaltyRate
    : lateEarlyHours * penaltyRate;

  const baseSalary = standardHours * hourlyRate;
  const currentNetSalary = currentMonthPayroll?.net_salary
    ? Number(currentMonthPayroll.net_salary)
    : Math.max(0, Math.round(baseSalary + otAmount - penaltyAmount + allowance));

  const pastPayrolls = employeePayrolls;

  // 5. Employee Work Shifts
  const employeeShifts = useMemo(() => {
    if (!currentEmp) return [];
    return workShifts
      .filter((s) => s.employee_id === currentEmp.employee_id || s.employee_id === currentEmp.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workShifts, currentEmp]);

  return {
    employeeAttendanceLogs,
    attendanceStats,
    employeePayrolls,
    currentMonthPayroll,
    hourlyRate,
    standardHours,
    overtimeHours,
    lateEarlyHours,
    allowance,
    currentNetSalary,
    pastPayrolls,
    employeeShifts,
    currentPeriodKey,
    baseSalary,
    otAmount,
    penaltyAmount,
    otRate,
    penaltyRate,
  };
}
