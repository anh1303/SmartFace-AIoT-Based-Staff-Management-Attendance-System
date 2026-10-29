import { describe, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js', () => ({ prisma: {} }))
import * as utils from '../../src/common/utils.js'
import { updateBonusPenaltySchema, updatePayrollSchema } from '../../src/modules/payroll/payroll.dto.js'

const salary = { hourly_rate: 100000, total_working_hours: 9, total_overtime: 2,
  total_late_early: 1, allowance: 1500000, overtime_rate: 5, late_early_penalty: 5 }

describe('Explicit payroll units', () => {
  it('uses five currency units per hour when the kind is fixed', () => {
    expect(utils.calculateNetSalary({ ...salary, overtime_rate_kind: 'FIXED_PER_HOUR', late_penalty_rate_kind: 'FIXED_PER_HOUR' })).toBe(2400005)
  })
  it('uses five times the hourly wage only for an explicit multiplier', () => {
    expect(utils.calculateNetSalary({ ...salary, overtime_rate_kind: 'HOURLY_MULTIPLIER', late_penalty_rate_kind: 'HOURLY_MULTIPLIER' })).toBe(2900000)
  })
  it('preserves independent zero fixed and multiplier rates', () => {
    expect(utils.calculateNetSalary({ ...salary, overtime_rate: 0, late_early_penalty: 0,
      overtime_rate_kind: 'HOURLY_MULTIPLIER', late_penalty_rate_kind: 'FIXED_PER_HOUR' })).toBe(2400000)
  })
  it('returns every monetary component from the same calculation as net salary', () => {
    expect(utils.computePayrollBreakdown({ ...salary, overtime_rate: 100000, late_early_penalty: 50000, total_absence_penalty: 25000 })).toEqual({
      base_salary: 900000, overtime_pay: 200000, late_early_deduction: 50000,
      absence_deduction: 25000, allowance: 1500000, net_salary: 2525000,
    })
  })
  it('rejects unknown units instead of guessing', () => {
    expect(() => utils.calculateNetSalary({ ...salary, overtime_rate_kind: 'UNKNOWN' as never })).toThrow()
  })
})

describe('Payroll rate and reconciliation input', () => {
  it('retains explicit rate kinds on policy updates', () => {
    expect(updateBonusPenaltySchema.parse({ overtime_rate: 5, overtime_rate_kind: 'FIXED_PER_HOUR' })).toMatchObject({ overtime_rate_kind: 'FIXED_PER_HOUR' })
  })
  it('requires rates and kinds together so old units cannot silently carry over', () => {
    expect(updateBonusPenaltySchema.safeParse({ overtime_rate: 5 }).success).toBe(false)
    expect(updateBonusPenaltySchema.safeParse({ late_early_penalty_kind: 'HOURLY_MULTIPLIER' }).success).toBe(false)
  })
  it('rejects unknown rate kinds', () => {
    expect(updateBonusPenaltySchema.safeParse({ overtime_rate: 5, overtime_rate_kind: 'UNKNOWN' }).success).toBe(false)
  })
  it('retains explicit reconciliation and stale-write timestamp fields', () => {
    expect(updatePayrollSchema.parse({ reconcile_working_hours: true, updated_at: '2026-10-29T01:00:00.000Z' })).toMatchObject({ reconcile_working_hours: true, updated_at: '2026-10-29T01:00:00.000Z' })
  })
  it('rejects simultaneous reset and reconciliation', () => {
    expect(updatePayrollSchema.safeParse({ reset_working_hours: true, reconcile_working_hours: true }).success).toBe(false)
  })
})
