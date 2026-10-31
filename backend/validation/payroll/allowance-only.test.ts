import { describe, expect, it } from 'vitest'
import { updatePayrollSchema } from '../../src/modules/payroll/payroll.dto.js'

describe('Allowance-only payroll edits', () => {
  it.each(['hourly_rate', 'total_working_hours', 'working_hours', 'total_overtime', 'total_late_early', 'status', 'reconcile_working_hours', 'reset_working_hours'])('rejects %s', field => {
    expect(updatePayrollSchema.safeParse({ allowance: 100, [field]: 1 }).success).toBe(false)
  })
  it('accepts an allowance, reason and version', () => {
    expect(updatePayrollSchema.safeParse({ allowance: 0, reason: 'Adjustment', updated_at: '2026-10-29T00:00:00.000Z' }).success).toBe(true)
  })
})
