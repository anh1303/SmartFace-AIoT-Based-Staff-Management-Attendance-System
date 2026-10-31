import { describe, expect, it } from 'vitest'
import { historicalBreakdown, historicalAdjustmentAmount, reconciliationSchema } from '../../src/common/payroll-history.js'

const snapshot = { source_reference: 'backup-before-migration#PR-1', overtime: { value: 100000, unit: 'FIXED_PER_HOUR' }, late: { value: 50000, unit: 'FIXED_PER_HOUR' } }
describe('Verified historical payroll', () => {
  it('reproduces verified fixed-price amounts even with zero wages', () => {
    expect(historicalBreakdown({ hourly_rate: 0, total_working_hours: 0, total_overtime: 2, total_late_early: 1, allowance: 0, total_absence_penalty: 0,
      calculation_details: { rate_snapshot_status: 'LEGACY_VERIFIED', verified_legacy_rates: snapshot } })).toMatchObject({ overtime_pay: 200000, late_early_deduction: 50000, net_salary: 150000 })
  })
  it('quotes verified old units without applying the current policy', () => {
    expect(historicalAdjustmentAmount({ calculation_details: { verified_legacy_rates: snapshot, rate_snapshot_status: 'LEGACY_VERIFIED' } }, 'OVERTIME', 2, 60000)).toBe(200000)
    expect(historicalAdjustmentAmount({ calculation_details: { rate_snapshot_status: 'UNRESOLVED' } }, 'OVERTIME', 2, 60000)).toBeNull()
  })
  it('requires a source reference, explicit units and expected record version', () => {
    expect(reconciliationSchema.safeParse({ source_reference: '', records: [{ id: '1', overtime: { value: 2 } }] }).success).toBe(false)
    expect(reconciliationSchema.safeParse({ source_reference: 'verified-backup', records: [{ id: '1', expected_updated_at: '2026-10-30T00:00:00.000Z', expected_net_salary: 150000, overtime: snapshot.overtime, late: snapshot.late }] }).success).toBe(true)
  })
  it('rejects even a tiny fifth-decimal remainder when preparing pending multipliers', () => {
    expect(reconciliationSchema.safeParse({ source_reference: 'reviewed-policy', records: [{ id: '1', expected_updated_at: '2026-10-30T00:00:00.000Z', expected_net_salary: 150000,
      prepare_pending_recalculation: true, overtime: { value: 1.000000000001, unit: 'HOURLY_MULTIPLIER' }, late: { value: 1.5, unit: 'HOURLY_MULTIPLIER' } }] }).success).toBe(false)
  })
})
