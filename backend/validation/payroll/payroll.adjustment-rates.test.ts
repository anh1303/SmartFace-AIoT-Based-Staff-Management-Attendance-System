import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ kind: 'FIXED_PER_HOUR', snapshot: null as any, hourlyRate: 100000, history: [] as any[] }))
vi.mock('../../src/config/database.js', () => ({ prisma: {
  employee: { findMany: vi.fn(async () => []) },
  attendanceAdjustment: { findMany: vi.fn(async () => [{ id: 1n, employee_id: 'emp', work_date: new Date('2026-10-29T00:00:00Z'), kind: 'OVERTIME', hours: 2, amount: 0, status: 'PENDING', updated_at: new Date(), employee: { employee_code: 'NV-001', full_name: 'Test', hourly_rate: state.hourlyRate, hourly_rate_history: state.history, user_id: null, position: { level: 'EMPLOYEE' }, users: null } }]) },
  bonusPenalty: { findFirst: vi.fn(async () => ({ overtime_rate: 5, overtime_rate_kind: state.kind, late_early_penalty: 50000, late_early_penalty_kind: 'FIXED_PER_HOUR' })) },
  payrollRecord: { findMany: vi.fn(async () => state.snapshot ? [state.snapshot] : []) },
  attendance_locks: { findMany: vi.fn(async () => []) },
} }))
import { listAdjustments } from '../../src/modules/payroll/payroll.adjustments.js'
beforeEach(() => { state.kind = 'FIXED_PER_HOUR'; state.snapshot = null; state.hourlyRate = 100000; state.history = [] })
describe('Adjustment monetary quotes use explicit snapshot units', () => {
  it('quotes current-month multiplier OT using the new profile wage before regeneration', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'))
    try {
      state.hourlyRate = 60000
      state.snapshot = { employeeId: 'emp', status: 'PENDING', hourly_rate: 50000, overtime_rate: 1.5, overtime_rate_kind: 'HOURLY_MULTIPLIER' }
      expect((await listAdjustments('2026-10', undefined, { id: 'admin', role: 'ADMIN' }))[0].amount).toBe(180000)
    } finally { vi.useRealTimers() }
  })
  it('quotes a past month from history when there is no payroll snapshot', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T10:00:00+07:00'))
    try {
      state.hourlyRate = 70000; state.history = [{ period: '2026-10', rate: 60000 }, { period: '2026-11', rate: 70000 }]; state.kind = 'HOURLY_MULTIPLIER'
      expect((await listAdjustments('2026-10', undefined, { id: 'admin', role: 'ADMIN' }))[0].amount).toBe(600000)
    } finally { vi.useRealTimers() }
  })
  it('quotes two hours at a fixed rate of five as ten, without interpreting five as a multiplier', async () => {
    expect((await listAdjustments('2026-10', undefined, { id: 'admin', role: 'ADMIN' }))[0].amount).toBe(10)
  })
  it('applies the multiplier only when explicitly typed', async () => {
    state.kind = 'HOURLY_MULTIPLIER'
    expect((await listAdjustments('2026-10', undefined, { id: 'admin', role: 'ADMIN' }))[0].amount).toBe(1000000)
  })
  it('does not invent a current-policy quote for a historical missing snapshot', async () => {
    state.snapshot = { employeeId: 'emp', status: 'FINALIZED', hourly_rate: 100000, overtime_rate: null, overtime_rate_kind: null }
    expect((await listAdjustments('2026-10', undefined, { id: 'admin', role: 'ADMIN' }))[0].amount).toBeNull()
  })
})
