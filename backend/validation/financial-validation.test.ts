import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/config/database.js',() => ({prisma:{}}))
import { calculateNetSalary } from '../src/common/utils.js'
import { workDateSchema } from '../src/common/date.schema.js'
import { updatePayrollSchema, generatePayrollSchema } from '../src/modules/payroll/payroll.dto.js'
const base = { hourly_rate:100000,total_working_hours:9,total_overtime:2,total_late_early:1,allowance:1500000,overtime_rate:100000,late_early_penalty:50000 }
describe('Financial/date input boundaries', () => {
  it('retains the agreed OT and penalty formula without OT in ordinary hours', () => expect(calculateNetSalary(base)).toBe(2550000))
  it('supports a legacy multiplier snapshot without repricing it', () => expect(calculateNetSalary({...base,overtime_rate:1.5})).toBe(2650000))
  it('accepts explicit zero wages, hours and allowance', () => expect(calculateNetSalary({...base,total_working_hours:0,total_overtime:0,total_late_early:0,allowance:0})).toBe(0))
  it.each([NaN,Infinity,-1])('rejects invalid financial input %s', amount => expect(() => calculateNetSalary({...base,hourly_rate:amount})).toThrow())
  it('rejects monetary overflow before DB writes', () => expect(() => calculateNetSalary({...base,hourly_rate:1e15})).toThrow(/giới hạn/))
  it.each(['2026-02-31','2026-04-31','2026-13-01','2026-10-00'])('rejects a nonexistent workdate %s', date => expect(workDateSchema.safeParse(date).success).toBe(false))
  it('accepts a leap date and rejects a non-leap Feb 29', () => {expect(workDateSchema.safeParse('2024-02-29').success).toBe(true);expect(workDateSchema.safeParse('2026-02-29').success).toBe(false)})
  it('validates negative payroll edits and invalid months', () => {
    expect(updatePayrollSchema.safeParse({total_overtime:-1}).success).toBe(false)
    expect(generatePayrollSchema.safeParse({period:'2026-99'}).success).toBe(false)
  })
})
