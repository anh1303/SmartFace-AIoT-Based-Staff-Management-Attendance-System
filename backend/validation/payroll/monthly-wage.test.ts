import { afterEach, describe, expect, it, vi } from 'vitest'
import { monthlyHourlyRate, recordHourlyRateChange } from '../../src/modules/employees/employee.wage.js'

afterEach(() => vi.useRealTimers())
describe('monthly hourly wage', () => {
  it('applies a mid-month change to the entire change month, but not earlier months', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'))
    const hourly_rate_history = recordHourlyRateChange({ hourly_rate: 50000 }, 60000, '2026-10')
    const employee = { hourly_rate: 60000, hourly_rate_history }
    expect(monthlyHourlyRate(employee, '2026-10', 50000)).toBe(60000)
    expect(monthlyHourlyRate(employee, '2026-09')).toBe(50000)
    expect(monthlyHourlyRate(employee, '2026-09', 45000)).toBe(45000)
  })
  it('retains the recorded October rate after a November change, including a stale October snapshot', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T10:00:00+07:00'))
    const october = { hourly_rate: 60000, hourly_rate_history: recordHourlyRateChange({ hourly_rate: 50000 }, 60000, '2026-10') }
    const employee = { hourly_rate: 70000, hourly_rate_history: recordHourlyRateChange(october, 70000, '2026-11') }
    expect(monthlyHourlyRate(employee, '2026-10', 50000)).toBe(60000)
    expect(monthlyHourlyRate(employee, '2026-11', 60000)).toBe(70000)
    expect(monthlyHourlyRate(employee, '2026-12')).toBe(70000)
  })
  it('keeps the last change in the same month and preserves explicit zero', () => {
    const first = { hourly_rate: 60000, hourly_rate_history: recordHourlyRateChange({ hourly_rate: 50000 }, 60000, '2026-10') }
    const history = recordHourlyRateChange(first, 0, '2026-10')
    expect(history.filter(row => row.period === '2026-10')).toHaveLength(1)
    expect(monthlyHourlyRate({ hourly_rate: 0, hourly_rate_history: history }, '2026-10')).toBe(0)
    expect(monthlyHourlyRate({ hourly_rate: 0, hourly_rate_history: history }, '2026-09')).toBe(50000)
  })
})
