import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ summaries: [] as any[], logs: [] as any[], shifts: [] as any[], locks: [] as any[] }))
vi.mock('../../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    employee: { findMany: vi.fn(async () => [{ id: 'emp', employee_code: 'NV-1', full_name: 'Fixture', hourly_rate: 100000 }]) },
    employee_shifts: { findMany: vi.fn(async () => state.shifts) },
    attendance_logs: { findMany: vi.fn(async () => state.logs) },
    daily_attendance_summary: {
      findMany: vi.fn(async () => state.summaries),
      upsert: vi.fn(async ({ create, update, where }: any) => {
        const previous = state.summaries.find(row => +row.work_date === +where.employee_id_work_date.work_date)
        if (previous) Object.assign(previous, update)
        else state.summaries.push({ id: BigInt(state.summaries.length + 1), reopened_at: null, ...create })
      }),
    },
    attendance_locks: { findMany: vi.fn(async () => state.locks) },
    attendanceAdjustment: { findMany: vi.fn(async () => []) },
    bonusPenalty: { findFirst: vi.fn(async () => null) },
    auditLog: { createMany: vi.fn() },
  }
  db.$transaction = async (work: any) => work(db)
  return { prisma: db }
})
import { configureAttendancePayroll } from '../../src/modules/attendance/attendance.payroll-port.js'
import { aggregateDailyAttendance } from '../../src/modules/attendance/attendance.aggregation.js'
import * as policy from '../../src/modules/attendance/attendance.policy.js'
configureAttendancePayroll({ findPeriodPayrolls: async () => [], payrollOverrides: () => ({ fields: {}, legacy: false }) } as any)
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); })

it('reuses unchanged days, rebuilds only the changed day, and skips locked days before calculating', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-19T21:00:00+07:00'))
  state.summaries = []; state.locks = []
  state.shifts = ['17', '18'].map(day => ({ employee_id: 'emp', shift_id: 1, work_date: new Date(`2026-11-${day}T00:00:00Z`), shift_type: 'OFFICE_HOURS', start_time: '08:00', end_time: '17:00', work_shifts: {} }))
  state.logs = ['17', '18'].flatMap((day, index) => [
    { id: BigInt(index * 2 + 1), employee_id: 'emp', type: 'CHECK_IN', event_time: new Date(`2026-11-${day}T08:00:00+07:00`), status: 'VALID' },
    { id: BigInt(index * 2 + 2), employee_id: 'emp', type: 'CHECK_OUT', event_time: new Date(`2026-11-${day}T17:00:00+07:00`), status: 'VALID' },
  ])
  const calculate = vi.spyOn(policy, 'calculateDay')
  await aggregateDailyAttendance(11, 2026)
  expect(calculate).toHaveBeenCalledTimes(2)
  calculate.mockClear()
  await aggregateDailyAttendance(11, 2026)
  expect(calculate).not.toHaveBeenCalled()
  state.logs[1].event_time = new Date('2026-11-17T15:30:00+07:00')
  await aggregateDailyAttendance(11, 2026)
  expect(calculate).toHaveBeenCalledTimes(1)
  expect(calculate.mock.calls[0][0]).toBe('2026-11-17')
  calculate.mockClear()
  state.locks = [{ work_date: new Date('2026-11-17T00:00:00Z') }]
  state.logs[1].event_time = new Date('2026-11-17T14:00:00+07:00')
  await aggregateDailyAttendance(11, 2026)
  expect(calculate).not.toHaveBeenCalled()
})

it('invalidates an unchanged scheduled day when its shift ends', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-19T16:00:00+07:00'))
  state.summaries = []; state.logs = []; state.locks = []
  state.shifts = [{ employee_id: 'emp', shift_id: 1, work_date: new Date('2026-11-19T00:00:00Z'), start_time: '08:00', end_time: '17:00', work_shifts: {} }]
  await aggregateDailyAttendance(11, 2026)
  expect(state.summaries[0].attendance_status).toBe('SCHEDULED')
  vi.setSystemTime(new Date('2026-11-19T17:00:00+07:00'))
  await aggregateDailyAttendance(11, 2026)
  expect(state.summaries[0].attendance_status).toBe('ABSENT')
})
