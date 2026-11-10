import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ rows: [] as any[], updates: 0, sizes: [] as number[], busy: false, failTransaction: 0 }))
vi.mock('../../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn(async () => [{ locked: !state.busy }]),
    daily_attendance_summary: {
      findMany: vi.fn(async ({ where }: any) => state.rows.filter(row =>
        (!where.work_date.gte || row.work_date >= where.work_date.gte) && row.work_date < where.work_date.lt && row.review_status !== 'APPROVED' && (!where.id || where.id.in.includes(row.id)))),
      findUnique: vi.fn(async ({ where }: any) => state.rows.find(row => row.id === where.id)),
      update: vi.fn(async ({ where, data }: any) => {
        // Reproduce exhausting a long transaction with serial per-row DB work.
        if (++state.updates > 20) throw new Error('P2028: simulated transaction budget exhausted')
        return Object.assign(state.rows.find(row => row.id === where.id), data)
      }),
    },
    attendanceAdjustment: { findMany: vi.fn(async () => []) },
    bonusPenalty: { findFirst: vi.fn(async () => null) },
    systemNotification: { createMany: vi.fn(async () => ({})) },
  }
  db.$transaction = async (callback: any) => {
    const snapshot = structuredClone(state.rows)
    state.updates = 0
    try {
      const result = await callback(db)
      if (state.sizes.length + 1 === state.failTransaction) throw new Error('simulated commit failure')
      return result
    }
    catch (error) { state.rows = snapshot; throw error }
    finally { state.sizes.push(state.updates) }
  }
  return { prisma: db }
})
import { autoCloseDueAttendance } from '../../src/modules/attendance/attendance.service.js'
import { configureAttendancePayroll } from '../../src/modules/attendance/attendance.payroll-port.js'

beforeEach(() => {
  state.busy = false; state.updates = 0; state.sizes = []; state.failTransaction = 0
  state.rows = Array.from({ length: 45 }, (_, i) => ({
    id: BigInt(i + 1), employee_id: `employee-${i}`, work_date: new Date('2026-10-02T00:00:00Z'),
    employees: { hourly_rate: 100000, hourly_rate_history: [] },
    policy_version: 'test', review_status: 'NONE', attendance_status: 'PRESENT', total_working_hours: 9,
    late_early: 0, overtime_candidate_hours: 0, first_check_in: new Date('2026-10-02T08:00:00+07:00'),
    last_check_out: new Date('2026-10-02T17:00:00+07:00'),
    calculation_details: { scheduledEnd: '2026-10-02T17:00:00+07:00', scheduledShiftSeconds: 32400, pairs: [{}], fingerprint: 'test', policy: 'test' },
  }))
  configureAttendancePayroll({ findPeriodPayrolls: async () => [], payrollOverrides: () => ({ fields: {} }) } as any)
})

it('commits small bounded batches instead of exhausting one transaction for the entire month', async () => {
  const result = await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))
  expect(result.closedCount).toBe(45)
  expect(state.rows.every(row => row.review_status === 'APPROVED')).toBe(true)
  expect(Math.max(...state.sizes)).toBeLessThanOrEqual(20)
  expect(state.sizes.filter(size => size > 0)).toHaveLength(3)
})
it('defers a busy period instead of waiting for its lock until the transaction expires', async () => {
  state.busy = true
  expect((await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).closedCount).toBe(0)
  expect(state.rows.every(row => row.review_status === 'NONE')).toBe(true)
})
it('catches up due historical months instead of silently excluding them', async () => {
  state.rows[0].work_date = new Date('2026-08-02T00:00:00Z')
  expect((await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).closedCount).toBe(45)
  expect(state.rows[0].review_status).toBe('APPROVED')
})
it('waits for exactly 00:05 VN and never closes today or a future day', async () => {
  state.rows = [state.rows[0]]
  state.rows[0].work_date = new Date('2026-08-02T00:00:00Z')
  state.rows[0].first_check_in = new Date('2026-08-02T08:00:00+07:00')
  state.rows[0].last_check_out = new Date('2026-08-02T17:00:00+07:00')
  state.rows[0].calculation_details.scheduledEnd = '2026-08-02T17:00:00+07:00'
  expect((await autoCloseDueAttendance(new Date('2026-08-02T23:59:00+07:00'))).closedCount).toBe(0)
  expect((await autoCloseDueAttendance(new Date('2026-08-03T00:04:59+07:00'))).closedCount).toBe(0)
  expect((await autoCloseDueAttendance(new Date('2026-08-03T00:05:00+07:00'))).closedCount).toBe(1)
})
it('preserves a manager reopen for 24 hours even when the work month is historical', async () => {
  Object.assign(state.rows[0], { work_date: new Date('2026-08-02T00:00:00Z'), reopened_at: new Date('2026-11-10T08:00:00+07:00'), reopened_by: 'MANAGER' })
  expect((await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).closedCount).toBe(44)
  expect(state.rows[0].review_status).toBe('NONE')
})
it('preserves historical attendance belonging to a closed payroll', async () => {
  state.rows = [state.rows[0]]
  state.rows[0].work_date = new Date('2026-08-02T00:00:00Z')
  configureAttendancePayroll({ findPeriodPayrolls: async () => [{ employeeId: state.rows[0].employee_id, status: 'FINALIZED' }], payrollOverrides: () => ({ fields: {} }) } as any)
  expect((await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).closedCount).toBe(0)
  expect(state.rows[0].review_status).toBe('NONE')
})
it('waits for the end of an overnight shift even after the 00:05 threshold', async () => {
  state.rows = [state.rows[0]]
  Object.assign(state.rows[0], { work_date: new Date('2026-08-02T00:00:00Z'), first_check_in: new Date('2026-08-02T22:00:00+07:00'), last_check_out: new Date('2026-08-03T06:00:00+07:00') })
  state.rows[0].calculation_details.scheduledEnd = '2026-08-03T06:00:00+07:00'
  expect((await autoCloseDueAttendance(new Date('2026-08-03T00:05:00+07:00'))).closedCount).toBe(0)
  expect((await autoCloseDueAttendance(new Date('2026-08-03T06:00:00+07:00'))).closedCount).toBe(1)
})
it('resumes after a failed batch without reapproving or recounting already committed days', async () => {
  state.failTransaction = 2
  await expect(autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).rejects.toThrow('simulated commit failure')
  expect(state.rows.filter(row => row.review_status === 'APPROVED')).toHaveLength(20)
  state.failTransaction = 0
  expect((await autoCloseDueAttendance(new Date('2026-11-10T09:00:00+07:00'))).closedCount).toBe(25)
  expect(state.rows.every(row => row.review_status === 'APPROVED')).toBe(true)
})
