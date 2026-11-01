import { describe, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js', () => ({ prisma: {} }))
import * as utils from '../../src/common/utils.js'
import { updateBonusPenaltySchema, updatePayrollSchema } from '../../src/modules/payroll/payroll.dto.js'

const salary = {
  hourly_rate: 100000,
  total_working_hours: 9,
  total_overtime: 2,
  total_late_early: 1,
  allowance: 1500000,
  overtime_rate: 2.0,
  late_early_penalty: 1.5,
}

describe('Multiplier-based payroll calculation', () => {
  it('calculates OT and penalty based on multiplier * hours * hourly_rate', () => {
    // base = 9 * 100k = 900k
    // OT = 2h * 2.0 * 100k = 400k
    // late = 1h * 1.5 * 100k = 150k
    // allowance = 1.500k
    // net = 900k + 400k - 150k + 1.500k = 2.650.000
    expect(utils.calculateNetSalary(salary)).toBe(2650000)
  })

  it('supports custom multipliers (e.g. OT 2.5x, late 2.0x)', () => {
    expect(utils.calculateNetSalary({ ...salary, overtime_rate: 2.5, late_early_penalty: 2.0 })).toBe(
      900000 + (2 * 2.5 * 100000) - (1 * 2.0 * 100000) + 1500000
    ) // 900k + 500k - 200k + 1500k = 2.700.000
  })

  it('handles zero multiplier rates correctly without deduction or bonus', () => {
    expect(utils.calculateNetSalary({ ...salary, overtime_rate: 0, late_early_penalty: 0 })).toBe(2400000)
  })

  it('returns every monetary breakdown component matching net salary', () => {
    expect(utils.computePayrollBreakdown({ ...salary, total_absence_penalty: 50000 })).toEqual({
      base_salary: 900000,
      overtime_pay: 400000,
      late_early_deduction: 150000,
      absence_deduction: 50000,
      allowance: 1500000,
      net_salary: 2600000,
    })
  })
})

describe('Payroll rate policy and reconciliation input schema', () => {
  it('accepts valid decimal multipliers for policy update', () => {
    const parsed = updateBonusPenaltySchema.parse({
      overtime_rate: 2.0,
      late_early_penalty: 1.5,
      absence_penalty_rate: 2.0,
      description: 'Cập nhật hệ số lương mới',
    })
    expect(parsed).toMatchObject({
      overtime_rate: 2.0,
      late_early_penalty: 1.5,
      absence_penalty_rate: 2.0,
    })
  })

  it('rejects negative multipliers or multipliers over 50', () => {
    expect(updateBonusPenaltySchema.safeParse({ overtime_rate: -0.5 }).success).toBe(false)
    expect(updateBonusPenaltySchema.safeParse({ overtime_rate: 55 }).success).toBe(false)
    expect(updateBonusPenaltySchema.safeParse({ late_early_penalty: -1 }).success).toBe(false)
    expect(updateBonusPenaltySchema.safeParse({ absence_penalty_rate: 100 }).success).toBe(false)
  })

  it('retains the allowance and stale-write timestamp', () => {
    expect(updatePayrollSchema.parse({ allowance: 0, updated_at: '2026-10-29T01:00:00.000Z' })).toMatchObject({ allowance: 0, updated_at: '2026-10-29T01:00:00.000Z' })
  })

  it('rejects simultaneous reset and reconciliation', () => {
    expect(updatePayrollSchema.safeParse({ reset_working_hours: true, reconcile_working_hours: true }).success).toBe(false)
  })
})
