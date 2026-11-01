// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Demo payroll multiplier consistency', () => {
  beforeEach(() => { vi.resetModules(); sessionStorage.setItem('smartface_demo_role', 'admin') })
  it('uses multiplier defaults and keeps breakdown consistent after editing an allowance', async () => {
    const { demoRequest } = await import('../../src/mocks/demoAdapter')
    const policy = (await demoRequest<any>('/api/payroll/bonus-penalty')).data
    expect(policy).toMatchObject({ overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2 })
    const rows = (await demoRequest<any[]>('/api/payroll')).data!
    const row = rows.find(row => row.status === 'PENDING')
    const updated = (await demoRequest<any>(`/api/payroll/${row.payroll_id}`, { method: 'PUT', body: JSON.stringify({ allowance: 0 }) })).data
    const expected = Math.max(0, Math.round(updated.total_working_hours * updated.hourly_rate + updated.total_overtime * 2 * updated.hourly_rate - updated.total_late_early * 1.5 * updated.hourly_rate - updated.total_absence_penalty))
    expect(updated.net_salary).toBe(expected)
    expect(updated.breakdown.net_salary).toBe(expected)
  })
  it('returns the policy effective in the requested period, not a future policy', async () => {
    const { demoRequest } = await import('../../src/mocks/demoAdapter')
    const created = await demoRequest<any>('/api/payroll/bonus-penalty', { method: 'PUT', body: JSON.stringify({ effective_period: '2099-01', overtime_rate: 3 }) })
    expect(created.success).toBe(true)
    expect((await demoRequest<any>('/api/payroll/bonus-penalty?period=2026-10')).data.overtime_rate).toBe(2)
    expect((await demoRequest<any>('/api/payroll/bonus-penalty?period=2099-01')).data.overtime_rate).toBe(3)
  })
})
