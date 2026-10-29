import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ rows: [] as any[] }))
vi.mock('../../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(), auditLog: { create: vi.fn() },
    payrollRecord: {
      findMany: vi.fn(async () => state.rows),
      updateMany: vi.fn(async ({ where, data }: any) => { for (const row of state.rows) if (where.id.in.includes(row.id)) Object.assign(row, data); return { count: where.id.in.length } }),
    },
    daily_attendance_summary: { findMany: vi.fn(async () => []) }, attendanceAdjustment: { findMany: vi.fn(async () => []) },
  }
  db.$transaction = (fn: any) => fn(db)
  return { prisma: db }
})
import { unlockPeriod } from '../../src/modules/payroll/payroll.service.js'
const row = (id: bigint, early: boolean, status = 'FINALIZED') => ({ id, employeeId: `employee${id}`, payroll_period: '2026-10', hourly_rate: 100000, total_working_hours: 0, total_overtime: 0, total_late_early: 0, allowance: 0, net_salary: 0, status, employee: { hourly_rate: 100000 }, calculation_details: early ? { early_settlement: { is_early_settlement: true, cutoff_date: '2026-10-15' } } : {} })
beforeEach(() => { vi.clearAllMocks(); state.rows = [row(1n, false), row(2n, true)] })
describe('period unlock exclusions', () => {
  it('opens ordinary staff while preserving an early-settled record and its cutoff', async () => {
    await unlockPeriod('2026-10')
    expect(state.rows.map(r => r.status)).toEqual(['PENDING', 'FINALIZED'])
    expect(state.rows[1].calculation_details.early_settlement.cutoff_date).toBe('2026-10-15')
  })
  it('does not open a paid ordinary record or change any other staff on that failed request', async () => {
    state.rows.push(row(3n, false, 'PAID'))
    await expect(unlockPeriod('2026-10')).rejects.toThrow(/đã trả/)
    expect(state.rows.map(r => r.status)).toEqual(['FINALIZED', 'FINALIZED', 'PAID'])
  })
  it('excludes a paid early-settled record without preventing other staff from opening', async () => {
    state.rows[1].status = 'PAID'
    await unlockPeriod('2026-10')
    expect(state.rows.map(r => r.status)).toEqual(['PENDING', 'PAID'])
  })
})
