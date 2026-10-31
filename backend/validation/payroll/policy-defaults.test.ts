import { describe, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js',() => ({prisma:{bonusPenalty:{findFirst:vi.fn(async () => null)}}}))
import { getBonusPenalty } from '../../src/modules/payroll/payroll.service.js'
describe('Company baseline rates', () => {
  it('uses multiplier OT 2.0, late/early 1.5, absence 2.0 if no policy row exists', async () => {
    expect(await getBonusPenalty()).toMatchObject({ overtime_rate: 2.0, late_early_penalty: 1.5, absence_penalty_rate: 2.0 })
  })
})
