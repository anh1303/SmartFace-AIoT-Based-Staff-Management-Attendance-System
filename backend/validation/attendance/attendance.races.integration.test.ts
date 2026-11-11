import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)

;(enabled ? describe : describe.skip)('concurrent attendance operations on PostgreSQL', () => {
  let db: any, attendance: any, shifts: any, payroll: any, admin: any
  beforeAll(async () => {
    await import('../../src/composition.js')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-02T12:00:00+07:00'))
    db = (await import('../../src/config/database.js')).prisma
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    shifts = await import('../../src/modules/shifts/shift.service.js')
    const { configureShiftAttendance } = await import('../../src/modules/shifts/shift.attendance-port.js')
    configureShiftAttendance(await import('../../src/modules/attendance/public.js'))
    payroll = await import('../../src/modules/payroll/payroll.service.js')
    await ensureTestPayrollPolicy(db)
    const role = await db.roles.findUnique({ where: { role_name: 'ADMIN' } })
    admin = await db.user.create({ data: { username: `race-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: role.id } })
  })
  afterAll(async () => { vi.useRealTimers(); if (db) await db.$disconnect() })

  async function fixture(date: string) {
    vi.setSystemTime(new Date(`${date}T23:00:00+07:00`))
    const employee = await db.employee.create({ data: { employee_code: `RACE-${randomUUID().slice(0,8)}`, full_name: 'Race test', hourly_rate: 100000, createdAt: new Date('2026-01-01T00:00:00Z') } })
    await shifts.assignOrUpdate({ employee_id: employee.id, date, shift_type: 'OFFICE_HOURS' }, admin.id, 'ADMIN')
    await db.attendance_logs.createMany({ data: [
      { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`), event_time: new Date(`${date}T08:00:00+07:00`), type: 'CHECK_IN' },
      { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`), event_time: new Date(`${date}T17:00:00+07:00`), type: 'CHECK_OUT' },
    ] })
    await attendance.adjustAttendance({ employeeId: employee.id, date, late_early: 0, overtime: 0, reason: 'review' }, admin.id, 'ADMIN')
    return employee
  }

  async function queueBoth(period: string, first: () => Promise<any>, second: () => Promise<any>) {
    let release!: () => void, ready!: () => void
    const locked = new Promise<void>(resolve => { ready = resolve })
    const proceed = new Promise<void>(resolve => { release = resolve })
    const barrier = db.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
      ready(); await proceed
    }, { timeout: 60000 })
    await locked
    const waitFor = async (count: number) => {
      for (let i = 0; i < 150; i++) {
        const rows = await db.$queryRaw`SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`
        if (rows[0].count >= count) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error(`Expected ${count} transactions waiting for advisory locks`)
    }
    let firstResult: Promise<PromiseSettledResult<any>> | undefined
    let secondResult: Promise<PromiseSettledResult<any>> | undefined
    try {
      firstResult = first().then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }))
      await waitFor(1)
      secondResult = second().then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }))
      await waitFor(2)
    } finally { release(); await barrier }
    return Promise.all([firstResult!, secondResult!])
  }

  it.each([['2026-08-05', true], ['2026-09-05', false]])('serializes shift change and day lock (%s)', async (date, shiftFirst) => {
    const employee = await fixture(date)
    const change = () => shifts.assignOrUpdate({ employee_id: employee.id, date, shift_type: 'MORNING' }, admin.id, 'ADMIN')
    const lock = () => attendance.toggleLock(date, true, admin.id, 'ADMIN')
    const outcomes = await queueBoth(date.slice(0, 7), shiftFirst ? change : lock, shiftFirst ? lock : change)
    const lockOutcome = outcomes[shiftFirst ? 1 : 0]
    expect(lockOutcome.status).toBe('fulfilled')
    const shiftOutcome = outcomes[shiftFirst ? 0 : 1]
    if (shiftFirst) expect(shiftOutcome.status).toBe('fulfilled')
    else expect(shiftOutcome.status).toBe('rejected')
    const summary = await db.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`) } } })
    const savedShift = await db.employee_shifts.findFirst({ where: { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`) } })
    expect(savedShift.shift_type).toBe(shiftFirst ? 'MORNING' : 'OFFICE_HOURS')
    expect(summary.review_status).toBe('APPROVED')
    expect((await db.attendance_locks.findUnique({ where: { work_date: new Date(`${date}T00:00:00Z`) } })).is_locked).toBe(true)
  })

  it.each([['2026-10-05', true], ['2026-11-05', false]])('serializes day lock and payroll finalization (%s)', async (date, lockFirst) => {
    const employee = await fixture(date)
    vi.setSystemTime(new Date('2026-12-02T12:00:00+07:00'))
    const period = date.slice(0, 7)
    await payroll.generate(period, employee.id, admin.id, { id: admin.id, role: 'ADMIN' })
    const lock = () => attendance.toggleLock(date, true, admin.id, 'ADMIN')
    const finalize = () => payroll.finalizePeriod(period, admin.id, 'ADMIN')
    const outcomes = await queueBoth(period, lockFirst ? lock : finalize, lockFirst ? finalize : lock)
    for (const outcome of outcomes) if (outcome.status === 'rejected') {
      expect(String(outcome.reason)).not.toMatch(/Transaction.*(expired|not found)|deadlock/i)
    }
    const record = await db.payrollRecord.findUnique({ where: { employeeId_payroll_period: { employeeId: employee.id, payroll_period: period } } })
    const summary = await db.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`) } } })
    if (record.status === 'FINALIZED') {
      expect(summary.review_status).toBe('APPROVED')
      expect(Number(record.total_working_hours)).toBe(Number(summary.total_working_hours))
    } else expect(record.status).toBe('PENDING')
    expect(outcomes.some(result => result.status === 'fulfilled')).toBe(true)
  })
})
