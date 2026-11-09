type PayrollPort = Pick<typeof import('../payroll/public.js'), 'isPayrollPeriodClosed' | 'getClosedPayrollEmployeeIds' | 'getPayrollWageSnapshot' | 'touchPendingPayrollForAttendance' | 'markPendingPayrollsRecompute' | 'findPeriodPayrolls' | 'payrollOverrides'>
let payroll: PayrollPort | undefined
export function configureAttendancePayroll(port: PayrollPort) { payroll = port }
export function attendancePayroll(): PayrollPort {
  if (!payroll) throw new Error('Attendance payroll integration is not configured')
  return payroll
}
