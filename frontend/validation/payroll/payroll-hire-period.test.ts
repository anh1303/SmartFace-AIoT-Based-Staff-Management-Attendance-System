import { expect, it } from 'vitest'
import { wasHiredByPayrollPeriod } from '../../src/utils/payrollUtils'

it('excludes employees hired after the selected VN month, retaining mid-month hires', () => {
  expect(wasHiredByPayrollPeriod('2026-09-01T01:00:00Z', '2026-08')).toBe(false)
  expect(wasHiredByPayrollPeriod('2026-08-31T17:00:00Z', '2026-08')).toBe(false)
  expect(wasHiredByPayrollPeriod('2026-08-31T16:59:59Z', '2026-08')).toBe(true)
  expect(wasHiredByPayrollPeriod('2026-08-15T08:00:00Z', '2026-08')).toBe(true)
  expect(wasHiredByPayrollPeriod('2026-01-01T08:00:00Z', '2026-08')).toBe(true)
})
