import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
;(enabled ? describe : describe.skip)('attendance workflow regressions on PostgreSQL', () => {
  let db: any, attendance: any
  beforeAll(async () => {
    await import('../../src/composition.js')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T01:00:00+07:00'))
    db = (await import('../../src/config/database.js')).prisma
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    await ensureTestPayrollPolicy(db)
  })
  afterAll(async () => { vi.useRealTimers(); await db?.$disconnect() })
  async function setup(date: string) {
    const employee = await db.employee.create({ data: { employee_code: `REG-${randomUUID().slice(0, 8)}`, full_name: 'Workflow test', hourly_rate: 100000 } })
    const shift = await db.work_shifts.create({ data: { shift_name: `REG-${randomUUID().slice(0, 8)}`, start_time: new Date('1970-01-01T08:00:00Z'), end_time: new Date('1970-01-01T17:00:00Z') } })
    const workDate = new Date(`${date}T00:00:00Z`)
    await db.employee_shifts.create({ data: { employee_id: employee.id, shift_id: shift.id, work_date: workDate, shift_type: 'OFFICE_HOURS', start_time: shift.start_time, end_time: shift.end_time } })
    return { employee, workDate }
  }
  it('recalculates invalidated source inside the lock before auto approval', async () => {
    const date = '2026-10-02', { employee, workDate } = await setup(date)
    const log = (type: string, time: string) => ({ employee_id: employee.id, work_date: workDate, type, event_time: new Date(`${date}T${time}+07:00`) })
    await db.attendance_logs.createMany({ data: [log('CHECK_IN', '08:00:00'), log('CHECK_OUT', '17:00:00')] })
    await attendance.aggregateDailyAttendance(10, 2026, employee.id, date)
    await db.attendance_logs.createMany({ data: [log('CHECK_IN', '18:00:00'), log('CHECK_OUT', '20:00:00')] })
    await db.daily_attendance_summary.update({ where: { employee_id_work_date: { employee_id: employee.id, work_date: workDate } }, data: { policy_version: null, requires_review: true, review_reason: 'SOURCE_CHANGED', review_status: 'PENDING' } })
    await attendance.autoCloseDueAttendance(new Date('2026-10-03T01:00:00+07:00'))
    const row = await db.daily_attendance_summary.findUniqueOrThrow({ where: { employee_id_work_date: { employee_id: employee.id, work_date: workDate } } })
    expect(row.review_status).toBe('APPROVED')
    expect(row.overtime_seconds).toBe(7200)
    expect(Number(row.overtime)).toBe(2)
  })
  it('does not approve an unfinished shift or block its later checkout', async () => {
    const date = '2026-10-04'; vi.setSystemTime(new Date(`${date}T09:00:00+07:00`))
    const { employee, workDate } = await setup(date)
    await attendance.checkIn({ employeeId: employee.id }, undefined, { capturedAt: +new Date(`${date}T08:00:00+07:00`) })
    await db.attendance_logs.updateMany({ where: { employee_id: employee.id }, data: { created_at: new Date(`${date}T09:00:00+07:00`) } })
    await expect(attendance.adjustAttendance({ employeeId: employee.id, date, overtime: 0, late_early: 0, reason: 'review' }, undefined, 'ADMIN')).rejects.toThrow()
    vi.setSystemTime(new Date(`${date}T17:00:00+07:00`))
    expect((await attendance.checkOut(employee.id, 'gate', undefined, { capturedAt: Date.now() })).status).toBe('VALID')
    const row = await db.daily_attendance_summary.findUniqueOrThrow({ where: { employee_id_work_date: { employee_id: employee.id, work_date: workDate } } })
    expect(Number(row.total_working_hours)).toBe(9)
  })
  it('denies replayed access when the recorded day has since been locked', async () => {
    const date = '2026-10-05'; vi.setSystemTime(new Date(`${date}T22:00:00+07:00`))
    const { employee } = await setup(date)
    const capture = { eventId: 'replay-event-123', deviceId: 'regression-gate', capturedAt: +new Date(`${date}T08:00:00+07:00`), verified: true }
    await attendance.checkIn({ employeeId: employee.id }, undefined, capture)
    await attendance.checkOut(employee.id, 'gate', undefined, { ...capture, eventId: 'replay-out-123', capturedAt: +new Date(`${date}T17:00:00+07:00`) })
    await attendance.toggleLock(date, true, undefined, 'ADMIN')
    expect(await attendance.checkIn({ employeeId: employee.id }, undefined, capture)).toMatchObject({ duplicate: true, status: 'VALID', access_denied: true })
  })
  it('blocks payroll based on an approved overnight summary calculated by the old rule', async () => {
    const date = '2026-09-30'; vi.setSystemTime(new Date('2026-10-03T01:00:00+07:00'))
    const employee = await db.employee.create({ data: { employee_code: `OLD-NIGHT-${randomUUID().slice(0, 8)}`, full_name: 'Old night', hourly_rate: 100000, createdAt: new Date('2026-09-01T00:00:00Z') } })
    const shift = await db.work_shifts.create({ data: { shift_name: `OLD-NIGHT-${randomUUID().slice(0, 8)}`, start_time: new Date('1970-01-01T22:00:00Z'), end_time: new Date('1970-01-01T06:00:00Z') } })
    const workDate = new Date(`${date}T00:00:00Z`)
    await db.employee_shifts.create({ data: { employee_id: employee.id, shift_id: shift.id, work_date: workDate, shift_type: 'OTHER', start_time: shift.start_time, end_time: shift.end_time } })
    await db.daily_attendance_summary.create({ data: { employee_id: employee.id, work_date: workDate, shift_id: shift.id, review_status: 'APPROVED', policy_version: '2026-10-26-v5', calculation_details: { scheduledStart: '2026-09-29T22:00:00+07:00', scheduledEnd: '2026-09-30T06:00:00+07:00' } } })
    await db.attendance_locks.create({ data: { work_date: workDate, is_locked: true } })
    await expect(attendance.toggleLock(date, true, undefined, 'ADMIN')).rejects.toThrow(/ca qua đêm.*quy tắc cũ/)
    const payroll = await import('../../src/modules/payroll/payroll.service.js')
    await expect(payroll.generate('2026-09', employee.id, undefined, { role: 'ADMIN' })).rejects.toThrow(/ca qua đêm.*quy tắc cũ/)
  })
  it('keeps the selected auto-close and four-hour overtime policy', async () => {
    const date = '2026-10-08'; vi.setSystemTime(new Date('2026-10-09T01:00:00+07:00'))
    const missing = await setup(date), overtime = await setup(date)
    const log = (employee: any, workDate: Date, type: string, time: string) => ({ employee_id: employee.id, work_date: workDate, type, event_time: new Date(`${date}T${time}+07:00`) })
    await db.attendance_logs.createMany({ data: [
      log(missing.employee, missing.workDate, 'CHECK_IN', '08:00:00'),
      log(overtime.employee, overtime.workDate, 'CHECK_IN', '08:00:00'),
      log(overtime.employee, overtime.workDate, 'CHECK_OUT', '22:00:00'),
    ] })
    for (const row of [missing, overtime]) await attendance.aggregateDailyAttendance(10, 2026, row.employee.id, date)
    await attendance.autoCloseDueAttendance(new Date('2026-10-09T01:00:00+07:00'))
    const missedDay = await db.daily_attendance_summary.findUniqueOrThrow({ where: { employee_id_work_date: { employee_id: missing.employee.id, work_date: missing.workDate } } })
    const penalty = await db.attendanceAdjustment.findFirstOrThrow({ where: { employee_id: missing.employee.id, kind: 'LATE_EARLY' } })
    const overtimeDay = await db.daily_attendance_summary.findUniqueOrThrow({ where: { employee_id_work_date: { employee_id: overtime.employee.id, work_date: overtime.workDate } } })
    expect(missedDay).toMatchObject({ attendance_status: 'INCOMPLETE', review_status: 'APPROVED' })
    expect(penalty.status).toBe('APPROVED'); expect(Number(penalty.hours)).toBe(9)
    expect(overtimeDay.overtime_seconds).toBe(18000); expect(Number(overtimeDay.overtime)).toBe(4); expect(overtimeDay.review_status).toBe('APPROVED')
  })
  it('records and calculates an overnight shift on its start date across months', async () => {
    const date = '2026-11-30'; vi.setSystemTime(new Date(`${date}T22:00:00+07:00`))
    const employee = await db.employee.create({ data: { employee_code: `NIGHT-${randomUUID().slice(0, 8)}`, full_name: 'Night' } })
    const shift = await db.work_shifts.create({ data: { shift_name: `NIGHT-${randomUUID().slice(0, 8)}`, start_time: new Date('1970-01-01T22:00:00Z'), end_time: new Date('1970-01-01T06:00:00Z') } })
    const workDate = new Date(`${date}T00:00:00Z`)
    await db.employee_shifts.create({ data: { employee_id: employee.id, shift_id: shift.id, work_date: workDate, shift_type: 'OTHER', start_time: shift.start_time, end_time: shift.end_time } })
    await attendance.checkIn({ employeeId: employee.id }, undefined, { capturedAt: Date.now() })
    vi.setSystemTime(new Date('2026-12-01T06:00:00+07:00'))
    const checkout = await attendance.checkOut(employee.id, 'gate', undefined, { capturedAt: Date.now() })
    expect(checkout.work_date).toBe(date)
    const row = await db.daily_attendance_summary.findUniqueOrThrow({ where: { employee_id_work_date: { employee_id: employee.id, work_date: workDate } } })
    expect(Number(row.total_working_hours)).toBe(8)
    expect(row.calculation_details.pairs).toHaveLength(1)
  })
})
