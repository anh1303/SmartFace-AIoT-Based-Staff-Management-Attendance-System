import { afterEach, describe, expect, it, vi } from 'vitest'
import { monthlyHourlyRate, recordHourlyRateChange } from '../../src/modules/employees/employee.wage.js'
import { nextPayrollPeriod } from '../../src/common/payroll-policy.js'

afterEach(() => vi.useRealTimers())

describe('monthly hourly wage next-period rule', () => {
  it('wage increase in October takes effect in November, keeping October at old rate', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T10:00:00+07:00'))

    // In October (2026-10), increasing wage from 50k to 60k is effective in next period (2026-11)
    const effectivePeriod = nextPayrollPeriod('2026-10')
    expect(effectivePeriod).toBe('2026-11')

    const hourly_rate_history = recordHourlyRateChange({ hourly_rate: 50000 }, 60000, effectivePeriod)
    const employee = { hourly_rate: 60000, hourly_rate_history }

    // October retains old rate (50,000)
    expect(monthlyHourlyRate(employee, '2026-10')).toBe(50000)
    expect(monthlyHourlyRate(employee, '2026-10', 50000)).toBe(50000)

    // November uses new rate (60,000)
    expect(monthlyHourlyRate(employee, '2026-11')).toBe(60000)
    expect(monthlyHourlyRate(employee, '2026-11', 50000)).toBe(60000)

    // Earlier month (September) also retains base rate or saved rate
    expect(monthlyHourlyRate(employee, '2026-09')).toBe(50000)
    expect(monthlyHourlyRate(employee, '2026-09', 45000)).toBe(45000)
  })

  it('handles multiple edits within the same month, keeping only latest for next period', () => {
    // First edit in October to 60,000 (effective 2026-11)
    const firstHistory = recordHourlyRateChange({ hourly_rate: 50000 }, 60000, '2026-11')
    // Second edit in October to 65,000 (replaces 2026-11 entry)
    const secondHistory = recordHourlyRateChange({ hourly_rate: 60000, hourly_rate_history: firstHistory }, 65000, '2026-11')

    expect(secondHistory.filter(row => row.period === '2026-11')).toHaveLength(1)

    const employee = { hourly_rate: 65000, hourly_rate_history: secondHistory }
    expect(monthlyHourlyRate(employee, '2026-10')).toBe(50000)
    expect(monthlyHourlyRate(employee, '2026-11')).toBe(65000)
    expect(monthlyHourlyRate(employee, '2026-12')).toBe(65000)
  })

  it('transitions from December to new year (2026-12 to 2027-01)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-20T10:00:00+07:00'))

    const nextPeriod = nextPayrollPeriod('2026-12')
    expect(nextPeriod).toBe('2027-01')

    const prevHistory = [
      { period: '0000-01', rate: 50000 },
      { period: '2026-11', rate: 65000 },
    ]

    const updatedHistory = recordHourlyRateChange(
      { hourly_rate: 65000, hourly_rate_history: prevHistory },
      70000,
      nextPeriod
    )

    const employee = { hourly_rate: 70000, hourly_rate_history: updatedHistory }

    // December 2026 still uses 65,000
    expect(monthlyHourlyRate(employee, '2026-12')).toBe(65000)

    // January 2027 uses new rate 70,000
    expect(monthlyHourlyRate(employee, '2027-01')).toBe(70000)
    expect(monthlyHourlyRate(employee, '2027-02')).toBe(70000)
  })
})

