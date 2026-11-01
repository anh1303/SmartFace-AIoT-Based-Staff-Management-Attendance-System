import { hasMultiplierSnapshot } from '../../common/payroll-policy.js'
import { historicalBreakdown } from '../../common/payroll-history.js'
import { computePayrollBreakdown } from '../../common/utils.js'
import type { PayrollStatus } from '../../common/constants.js'

export interface RawPayrollRecord {
  id: string | bigint
  payroll_period: string
  employeeId: string
  hourly_rate?: { toString(): string } | number | string | null
  total_working_hours?: { toString(): string } | number | string | null
  total_overtime?: { toString(): string } | number | string | null
  total_absence_penalty?: unknown
  total_late_early?: { toString(): string } | number | string | null
  allowance?: { toString(): string } | number | string | null
  net_salary?: { toString(): string } | number | string | null
  status?: string | null
  reason?: string | null
  overtime_rate?: unknown
  late_penalty_rate?: unknown
  updated_at?: Date
  late_early_penalty?: number | null
  calculation_details?: unknown
  employee?: { employee_code?: string; full_name?: string; department?: { name?: string } | null } | null
}

export function formatPayrollRecord(record: RawPayrollRecord) {
  const hourly_rate = Number(record.hourly_rate || 0)
  const total_working_hours = Number(record.total_working_hours ?? 0)
  const total_overtime = Number(record.total_overtime || 0)
  const total_late_early = Number(record.total_late_early || 0)
  const allowance = Number(record.allowance || 0)
  const net_salary = Number(record.net_salary || 0)
  const details = (record.calculation_details || {}) as Record<string, any>
  const hasRateSnapshot = hasMultiplierSnapshot(record)
  const breakdown = hasRateSnapshot ? computePayrollBreakdown({
    hourly_rate, total_working_hours, total_overtime, total_late_early, allowance,
    overtime_rate: Number(record.overtime_rate), late_early_penalty: Number(record.late_penalty_rate),
    total_absence_penalty: Number(record.total_absence_penalty || 0),
  }) : historicalBreakdown({ hourly_rate, total_working_hours, total_overtime, total_late_early, allowance,
    total_absence_penalty: Number(record.total_absence_penalty || 0), calculation_details: record.calculation_details })
  const verifiedHistory = details.rate_snapshot_status === 'LEGACY_VERIFIED' && breakdown?.net_salary === net_salary && record.status !== 'PENDING'

  let status: PayrollStatus = 'PENDING'
  if (record.status === 'PAID') status = 'PAID'
  else if (record.status === 'FINALIZED') status = 'FINALIZED'
  else if (record.status === 'CONFIRMED') status = 'CONFIRMED'
  else status = 'PENDING'

  return {
    id: record.id.toString(),
    payroll_id: `PR-${record.payroll_period.replace('-', '')}-${record.id.toString().padStart(3, '0')}`,
    employee_id: record.employee?.employee_code || record.employeeId,
    employee_name: record.employee?.full_name || '',
    department: record.employee?.department?.name || '',
    period: record.payroll_period,
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    total_absence_penalty: Number(record.total_absence_penalty || 0),
    allowance,
    net_salary,
    overtime_rate: hasRateSnapshot ? Number(record.overtime_rate) : null,
    late_penalty_rate: hasRateSnapshot ? Number(record.late_penalty_rate) : null,
    breakdown,
    updated_at: record.updated_at?.toISOString(),
    requires_reconciliation: Boolean(details.requires_reconciliation || !hasRateSnapshot && !verifiedHistory),
    needs_recalculation: Boolean(details.needs_recalculation || !hasRateSnapshot && !verifiedHistory),
    calculation_details: record.calculation_details,
    status,
    reason: record.reason || undefined,
  }
}

