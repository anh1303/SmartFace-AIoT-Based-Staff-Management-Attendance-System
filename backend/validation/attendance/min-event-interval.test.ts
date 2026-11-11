import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] as any[], locks: [] as string[], locked: false, seconds: 600 }))
const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $executeRaw: vi.fn(),
  attendance_logs: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  attendance_locks: { findUnique: vi.fn(async () => null) },
  daily_attendance_summary: { findUnique: vi.fn(async () => null), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
}))
const published = vi.hoisted(() => vi.fn())
const aggregate = vi.hoisted(() => vi.fn(async () => ({ details: [] })))
const shifts = vi.hoisted(() => vi.fn(async () => []))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/config/env.js', () => ({ env: { get ATTENDANCE_MIN_EVENT_INTERVAL_SECONDS() { return state.seconds } } }))
vi.mock('../../src/common/event-bus.js', () => ({ eventBus: { publish: published } }))
vi.mock('../../src/modules/attendance/attendance.aggregation.js', () => ({ aggregateDailyAttendance: aggregate }))
vi.mock('../../src/modules/attendance/attendance.format.js', () => ({ formatAttendanceRecords: vi.fn(async rows => rows.map((row: any) => ({ ...row, id: String(row.id) }))) }))
vi.mock('../../src/modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: vi.fn(async id => ({ id, employee_code: id, status: 'ACTIVE' })),
  findEmployeeWageProfile: vi.fn(async id => ({ id, status: 'ACTIVE' })),
}))
vi.mock('../../src/modules/shifts/public.js', () => ({ getEmployeeNearShifts: shifts }))
vi.mock('../../src/modules/payroll/public.js', () => ({ isPayrollPeriodClosed: vi.fn(async () => false) }))
import { checkIn, checkOut } from '../../src/modules/attendance/attendance.service.js'
import { isPayrollPeriodClosed } from '../../src/modules/payroll/public.js'

const now = new Date('2026-11-06T08:00:00+07:00')
const prior = (overrides = {}) => ({ id: 'prior', employee_id: 'a', type: 'CHECK_IN', status: 'VALID', created_at: new Date(+now - 60_000), event_time: new Date(+now - 60_000), work_date: new Date('2026-11-06T00:00:00Z'), ...overrides })
const scan = (type: string, id = 'a', capturedAt = Date.now()) => type === 'CHECK_IN'
  ? checkIn({ employeeId: id }, undefined, { verified: true, capturedAt })
  : checkOut(id, 'device:test', undefined, { verified: true, capturedAt })

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  state.rows = []; state.locks = []; state.locked = false; state.seconds = 600
  let queue = Promise.resolve()
  db.$transaction.mockImplementation(async callback => {
    const previous = queue
    let release!: () => void
    queue = new Promise<void>(resolve => { release = resolve })
    await previous
    try { return await callback(db) } finally { state.locked = false; release() }
  })
  db.$executeRaw.mockImplementation(async (_query, value) => {
    state.locks.push(value)
    if (String(value).startsWith('employee:')) state.locked = true
    return 1
  })
  db.attendance_logs.findUnique.mockResolvedValue(null)
  db.attendance_logs.findFirst.mockImplementation(async ({ where, orderBy }) => {
    if (!state.locked) throw new Error('Read before employee lock')
    const field = orderBy[0].created_at ? 'created_at' : 'event_time'
    return state.rows.filter(row => row.employee_id === where.employee_id && row.status === where.status && (!where.event_time?.lte || +row.event_time <= +where.event_time.lte))
      .sort((a, b) => +b[field] - +a[field])[0] ?? null
  })
  db.attendance_logs.create.mockImplementation(async ({ data }) => {
    const row = { ...data, id: `row-${state.rows.length}`, created_at: new Date() }
    state.rows.push(row); return row
  })
})
afterEach(() => vi.useRealTimers())

it.each(['CHECK_IN', 'CHECK_OUT'])('ignores %s inside the shared interval without changing rows, summaries or events', async type => {
  state.rows = [prior()]
  const result = await scan(type)
  expect(result).toMatchObject({ ignored: true, cooldown: true, retry_after_seconds: 540 })
  expect(state.rows).toHaveLength(1)
  expect(state.locks).toContain('employee:a')
  expect(shifts).not.toHaveBeenCalled(); expect(aggregate).not.toHaveBeenCalled(); expect(published).not.toHaveBeenCalled()
})

it('accepts the exact boundary, ignores flagged rows and isolates employees', async () => {
  state.rows = [prior({ created_at: new Date(+now - 600_000), event_time: new Date(+now - 600_000) }), prior({ id: 'flagged', status: 'FLAGGED' }), prior({ id: 'other', employee_id: 'b' })]
  const result = await scan('CHECK_OUT')
  expect(result).not.toHaveProperty('ignored', true)
  expect(state.rows.filter(row => row.employee_id === 'a' && row.status === 'VALID')).toHaveLength(2)
  expect(published.mock.calls.filter(call => call[0] === 'attendance:checked-out')).toHaveLength(1)
})

it('uses server receipt time, so manipulated capture timestamps cannot bypass the interval', async () => {
  state.rows = [prior({ event_time: new Date(+now - 600_000) })]
  expect(await scan('CHECK_OUT', 'a', +now + 110_000)).toMatchObject({ ignored: true })
  vi.setSystemTime(new Date(+now + 540_000))
  expect(await scan('CHECK_OUT')).not.toHaveProperty('ignored', true)
})

it('applies the configured 30-minute interval and does not move its baseline on ignored scans', async () => {
  state.seconds = 1800; state.rows = [prior()]
  expect(await scan('CHECK_OUT')).toMatchObject({ ignored: true, retry_after_seconds: 1740 })
  vi.setSystemTime(new Date(+now + 1740_000))
  expect(await scan('CHECK_OUT')).not.toHaveProperty('ignored', true)
})

it('serializes overlapping employee scans so only one creates an attendance event', async () => {
  const results = await Promise.all([scan('CHECK_IN'), scan('CHECK_OUT')])
  expect(state.rows).toHaveLength(1)
  expect(results.filter(result => (result as any).ignored)).toHaveLength(1)
  expect(published.mock.calls.filter(call => call[0].startsWith('attendance:checked-'))).toHaveLength(1)
})

it('supports a five-second demo interval and accepts its exact boundary', async () => {
  state.seconds = 5
  state.rows = [prior({ created_at: new Date(+now - 1000), event_time: new Date(+now - 1000) })]
  expect(await scan('CHECK_OUT')).toMatchObject({ ignored: true, retry_after_seconds: 4 })
  vi.setSystemTime(new Date(+now + 3999))
  expect(await scan('CHECK_OUT')).toMatchObject({ ignored: true, retry_after_seconds: 1 })
  vi.setSystemTime(new Date(+now + 4000))
  expect(await scan('CHECK_OUT')).not.toHaveProperty('ignored', true)
})

it('checks the accepted day once under the transaction locks instead of rereading it for invalidation', async () => {
  const result = await scan('CHECK_IN')
  expect(result).toMatchObject({ ignored: false, status: 'VALID' })
  expect(isPayrollPeriodClosed).toHaveBeenCalledTimes(1)
  expect(db.attendance_locks.findUnique).toHaveBeenCalledTimes(1)
  expect(db.daily_attendance_summary.findUnique).toHaveBeenCalledTimes(1)
  expect(db.daily_attendance_summary.upsert).toHaveBeenCalledTimes(1)
  expect(state.locks).toContain('employee:a')
})
