import { z } from 'zod'
import { computePayrollBreakdown } from './payroll-rates.js'

const historicalRateSchema = z.object({ value: z.number().finite().min(0).max(1e9), unit: z.enum(['FIXED_PER_HOUR', 'HOURLY_MULTIPLIER']) })
const multiplierSchema = z.number().finite().min(0).max(50).multipleOf(0.0001)
const verifiedRatesSchema = z.object({ source_reference: z.string().trim().min(1), overtime: historicalRateSchema, late: historicalRateSchema })
export const reconciliationSchema = z.object({
  source_reference: z.string().trim().min(1),
  records: z.array(z.object({
    id: z.string().regex(/^\d+$/), expected_updated_at: z.string().datetime(), expected_net_salary: z.number().finite().nonnegative(),
    overtime: historicalRateSchema, late: historicalRateSchema,
    prepare_pending_recalculation: z.boolean().optional(),
  })).default([]),
  policies: z.array(z.object({
    effective_period: z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/),
    overtime_rate: multiplierSchema,
    late_early_penalty: multiplierSchema,
    absence_penalty_rate: multiplierSchema,
  })).default([]),
}).superRefine((data, ctx) => {
  if (!data.records.length && !data.policies.length) ctx.addIssue({ code: 'custom', message: 'Supply records or verified policies' })
  if (new Set(data.policies.map(row => row.effective_period)).size !== data.policies.length) ctx.addIssue({ code: 'custom', message: 'Duplicate effective periods' })
  if (new Set(data.records.map(row => row.id)).size !== data.records.length) ctx.addIssue({ code: 'custom', message: 'Duplicate payroll IDs' })
  for (const row of data.records) if (row.prepare_pending_recalculation) {
    for (const rate of [row.overtime, row.late]) if (rate.unit !== 'HOURLY_MULTIPLIER' || !multiplierSchema.safeParse(rate.value).success) {
      ctx.addIssue({ code: 'custom', message: 'Pending recalculation requires reviewed multipliers in [0,50] with at most four decimal places' })
    }
  }
})

type HistoricalRecord = { calculation_details?: unknown }
function verifiedRates(record: HistoricalRecord) {
  const details = record.calculation_details as Record<string, unknown> | null
  if (details?.rate_snapshot_status !== 'LEGACY_VERIFIED') return null
  const parsed = verifiedRatesSchema.safeParse(details.verified_legacy_rates)
  return parsed.success ? parsed.data : null
}

export function historicalAdjustmentAmount(record: HistoricalRecord, kind: string, hours: number, hourlyRate: number) {
  const rates = verifiedRates(record)
  if (!rates) return null
  const rate = kind === 'OVERTIME' ? rates.overtime : rates.late
  return hours * rate.value * (rate.unit === 'HOURLY_MULTIPLIER' ? hourlyRate : 1)
}

export function historicalBreakdown(record: HistoricalRecord & { hourly_rate: number; total_working_hours: number; total_overtime: number; total_late_early: number; allowance: number; total_absence_penalty: number }) {
  if (!verifiedRates(record)) return null
  const base = computePayrollBreakdown({ ...record, overtime_rate: 0, late_early_penalty: 0 })
  const overtime_pay = historicalAdjustmentAmount(record, 'OVERTIME', record.total_overtime, record.hourly_rate)!
  const late_early_deduction = historicalAdjustmentAmount(record, 'LATE_EARLY', record.total_late_early, record.hourly_rate)!
  return { ...base, overtime_pay, late_early_deduction,
    net_salary: Math.max(0, Math.round(base.base_salary + overtime_pay - late_early_deduction - base.absence_deduction + base.allowance)) }
}
