import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] as any[] }))
vi.mock('../../src/config/database.js', () => ({ prisma: {
  bonusPenalty: { findFirst: vi.fn(async ({ where }: any = {}) => state.rows
    .filter(row => !where || where.effective_period?.lte && row.effective_period != null && row.effective_period <= where.effective_period.lte)
    .sort((a, b) => (b.effective_period ?? '').localeCompare(a.effective_period ?? '') || b.id - a.id)[0] ?? null) },
} }))
import { policyForPeriod } from '../../src/common/payroll-policy.js'
import { getBonusPenalty } from '../../src/modules/payroll/payroll.service.js'
import { updateBonusPenaltySchema } from '../../src/modules/payroll/payroll.dto.js'

beforeEach(() => { state.rows = [] })
describe('Effective payroll policies', () => {
  it('uses the same defaults for attendance and payroll on an unconfigured database', async () => {
    expect(await policyForPeriod('2026-10')).toMatchObject({ overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2 })
  })
  it('selects the policy effective in that month rather than a newer policy', async () => {
    state.rows = [
      { id: 1, effective_period: '2026-10', overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2 },
      { id: 2, effective_period: '2026-11', overtime_rate: 3, late_early_penalty: 2, absence_penalty_rate: 4 },
    ]
    expect(await policyForPeriod('2026-10')).toMatchObject({ id: 1, absence_penalty_rate: 2 })
    expect(await policyForPeriod('2026-11')).toMatchObject({ id: 2, absence_penalty_rate: 4 })
    expect(await policyForPeriod('2026-09')).toBeNull()
    expect(await getBonusPenalty('2026-10')).toMatchObject({ id: 1, overtime_rate: 2 })
    expect(await getBonusPenalty('2026-09')).toBeNull()
  })
  it('does not guess the effective month of an unversioned historical policy', async () => {
    state.rows = [{ id: 1, effective_period: null, overtime_rate: 100000 }]
    expect(await policyForPeriod('2026-09')).toBeNull()
  })
  it.each([0, 2, 9.9999, 10, 50])('accepts a storable four-decimal multiplier %s', value => {
    expect(updateBonusPenaltySchema.safeParse({ absence_penalty_rate: value }).success).toBe(true)
  })
  it.each([-1, 50.0001, 1.23456, Infinity, NaN])('rejects an invalid or lossy multiplier %s', value => {
    expect(updateBonusPenaltySchema.safeParse({ overtime_rate: value }).success).toBe(false)
  })
})
