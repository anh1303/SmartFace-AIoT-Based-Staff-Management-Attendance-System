import { describe, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js',() => ({prisma:{bonusPenalty:{findFirst:vi.fn(async () => null)}}}))
import { getBonusPenalty } from '../../src/modules/payroll/payroll.service.js'
describe('Company baseline rates', () => {
  it('uses fixed OT 100000 and penalty 50000 if no policy row exists', async () => {
    expect(await getBonusPenalty()).toMatchObject({overtime_rate:100000,overtime_rate_kind:'FIXED_PER_HOUR',late_early_penalty:50000,late_early_penalty_kind:'FIXED_PER_HOUR',absence_penalty_rate:0.25})
  })
})
