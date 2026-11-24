/**
 * Shared PostgreSQL advisory lock key conventions.
 * Keys MUST remain byte-for-byte stable across rolling deployments.
 */
export function employeeLockKey(employeeId: string): string {
  return `employee:${employeeId}`
}

export function payrollPeriodLockKey(period: string): string {
  return `payroll:${period}`
}
