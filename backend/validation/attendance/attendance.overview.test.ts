import { describe, expect, it } from 'vitest'
import { summarizeEmployeeMonth } from '../../src/modules/attendance/attendance.overview.js'

describe('employee month-to-date overview', () => {
  it('uses persisted credits, approved OT and actual absence only within the current month through today', () => {
    const result = summarizeEmployeeMonth([
      { date: '2026-10-31', total_working_hours: 8, overtime: 4, late_early: 3, status: 'ABSENT' },
      { date: '2026-11-02', total_working_hours: 8, overtime: 1.5, late_early: 0.5, status: 'PRESENT' },
      { date: '2026-11-03', total_working_hours: 0, overtime: 0, late_early: 0, status: 'ABSENT' },
      { date: '2026-11-04', total_working_hours: 0, overtime: 0, late_early: 9, status: 'MISSING_CHECK_OUT' },
      { date: '2026-11-06', total_working_hours: 8, overtime: 0, late_early: 0, status: 'PRESENT' },
      { date: '2026-11-07', total_working_hours: 8, overtime: 2, late_early: 1, status: 'ABSENT' },
    ], '2026-11-06')
    expect(result).toEqual({ period: '2026-11', through_date: '2026-11-06', work_days: 2, working_hours: 16, overtime_hours: 1.5, late_early_hours: 9.5, absent_days: 1 })
  })
  it('keeps unavailable totals empty when no daily records have been stored', () => {
    expect(summarizeEmployeeMonth([], '2026-01-01')).toEqual({ period: '2026-01', through_date: '2026-01-01', work_days: null, working_hours: null, overtime_hours: null, late_early_hours: null, absent_days: null })
  })
})
