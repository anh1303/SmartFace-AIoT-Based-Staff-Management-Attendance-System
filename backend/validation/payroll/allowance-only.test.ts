import { describe, expect, it } from 'vitest'
import { previewPayrollSchema, updatePayrollSchema } from '../../src/modules/payroll/payroll.dto.js'
import { payrollRouter } from '../../src/modules/payroll/payroll.routes.js'

describe('Allowance-only payroll edits', () => {
  it.each(['hourly_rate', 'total_working_hours', 'working_hours', 'total_overtime', 'total_late_early', 'status', 'reconcile_working_hours', 'reset_working_hours'])('rejects %s', field => {
    expect(updatePayrollSchema.safeParse({ allowance: 100, [field]: 1 }).success).toBe(false)
  })
  it('accepts an allowance, reason and version', () => {
    expect(updatePayrollSchema.safeParse({ allowance: 0, reason: 'Adjustment', updated_at: '2026-10-29T00:00:00.000Z' }).success).toBe(true)
  })
  it.each([-1, Number.NaN, Infinity, 1_000_000_000_001])('rejects an invalid preview allowance %s', allowance => {
    expect(previewPayrollSchema.safeParse({ allowance, updated_at: '2026-10-29T00:00:00.000Z' }).success).toBe(false)
  })
  it('requires a valid version for preview', () => {
    expect(previewPayrollSchema.safeParse({ allowance: 0 }).success).toBe(false)
    expect(previewPayrollSchema.safeParse({ allowance: 0, updated_at: 'not-a-date' }).success).toBe(false)
  })
  it('matches the early-settlement preview before the item preview route', () => {
    const paths = (payrollRouter as any).stack.filter((layer: any) => layer.route?.methods.post).map((layer: any) => layer.route.path)
    expect(paths.indexOf('/early-settlement/preview')).toBeLessThan(paths.indexOf('/:id/preview'))
  })
})
