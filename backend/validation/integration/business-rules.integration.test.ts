import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'
const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip

suite('Business payroll rules in isolated PostgreSQL', () => {
  let db: any, payroll: any, employees: any, attendance: any, shifts: any, admin: any
  const prefix = randomUUID().slice(0, 8)
  const employee = (name: string) => db.employee.create({ data: { employee_code: `BIZ-${prefix}-${name}`, full_name: name, hourly_rate: 50000 } })
  beforeAll(async () => {
    db = (await import('../../src/config/database.js')).prisma
    await ensureTestPayrollPolicy(db)
    payroll = await import('../../src/modules/payroll/payroll.service.js')
    employees = await import('../../src/modules/employees/employee.service.js')
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    shifts = await import('../../src/modules/shifts/shift.service.js')
    const role = await db.roles.upsert({ where: { role_name: 'ADMIN' }, create: { role_name: 'ADMIN' }, update: {} })
    const user = await db.user.create({ data: { username: `biz-${prefix}`, passwordHash: 'test-only', role_id: role.id } })
    admin = { id: user.id, role: 'ADMIN' }
  })
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T20:00:00+07:00')) })
  afterAll(async () => { vi.useRealTimers(); if (db) await db.$disconnect() })

  it('refuses a cutoff before a durable raw scan, including null legacy work_date', async () => {
    const emp = await employee('cutoff')
    await db.payrollRecord.create({ data: { employeeId: emp.id, payroll_period: '2026-10' } })
    await db.attendance_logs.create({ data: { employee_id: emp.id, type: 'CHECK_IN', event_time: new Date('2026-10-28T08:00:00+07:00'), status: 'VALID', method: 'FACE' } })
    const input = { employeeId: emp.id, period: '2026-10', cutoffDate: '2026-10-27', reason: 'Nghỉ việc' }
    expect(await payroll.previewEarlySettlement(input, admin.id, 'ADMIN')).toMatchObject({ blocked: true, conflict_dates: ['2026-10-28'] })
    await expect(payroll.finalizeEarlySettlement(input, admin.id, 'ADMIN')).rejects.toThrow(/sau ngày quyết toán/)
    expect((await db.employee.findUnique({ where: { id: emp.id } })).status).toBe('ACTIVE')
    expect(await db.attendance_logs.count({ where: { employee_id: emp.id } })).toBe(1)
  })

  it('rolls back wage finalization, termination and future shift deletion if the audit insert fails', async () => {
    const emp = await employee('rollback')
    await shifts.assignOrUpdate({ employee_id: emp.id, date: '2026-10-30', shift_type: 'OFFICE_HOURS' }, admin.id, 'ADMIN')
    await payroll.generate('2026-10', emp.id, admin.id, admin)
    await expect(payroll.finalizeEarlySettlement({ employeeId: emp.id, period: '2026-10', cutoffDate: '2026-10-28', reason: 'Must roll back' }, randomUUID(), 'ADMIN')).rejects.toThrow()
    expect((await db.employee.findUnique({ where: { id: emp.id } })).status).toBe('ACTIVE')
    expect((await db.payrollRecord.findUnique({ where: { employeeId_payroll_period: { employeeId: emp.id, payroll_period: '2026-10' } } })).status).toBe('PENDING')
    expect(await db.employee_shifts.count({ where: { employee_id: emp.id } })).toBe(1)
  })

  it('retains October wages after a November profile update and uses the old baseline for ungenerated September', async () => {
    const emp = await employee('wages')
    await employees.updateWithManagerCheck(emp.id, { hourly_rate: 60000 }, admin)
    vi.setSystemTime(new Date('2026-11-10T20:00:00+07:00'))
    await employees.updateWithManagerCheck(emp.id, { hourly_rate: 70000 }, admin)
    expect((await payroll.generate('2026-10', emp.id, admin.id, admin))[0].hourly_rate).toBe(60000)
    expect((await payroll.generate('2026-09', emp.id, admin.id, admin))[0].hourly_rate).toBe(50000)
    expect((await payroll.generate('2026-11', emp.id, admin.id, admin))[0].hourly_rate).toBe(70000)
  })

  it('stores a 20:00–04:00 shift and both scans under its starting work date', async () => {
    const emp = await employee('night-live')
    const date = '2026-10-29'
    await shifts.assignOrUpdate({ employee_id: emp.id, date, shift_type: 'OTHER', start_time: '20:00', end_time: '04:00' }, admin.id, 'ADMIN')
    const capture = { deviceId: `TEST_NIGHT_${prefix}`, eventId: `night-in-${prefix}`, capturedAt: +new Date(`${date}T20:00:00+07:00`) }
    await attendance.checkIn({ employeeId: emp.id }, undefined, capture)
    vi.setSystemTime(new Date('2026-10-30T04:00:00+07:00'))
    await attendance.checkOut(emp.id, undefined, undefined, { ...capture, eventId: `night-out-${prefix}`, capturedAt: +new Date('2026-10-30T04:00:00+07:00') })
    const assignment = await db.employee_shifts.findFirst({ where: { employee_id: emp.id } })
    const logs = await db.attendance_logs.findMany({ where: { employee_id: emp.id }, orderBy: { event_time: 'asc' } })
    expect(assignment.work_date.toISOString().slice(0, 10)).toBe(date)
    expect(logs.map((log: any) => log.work_date.toISOString().slice(0, 10))).toEqual([date, date])
    expect(logs[1].event_time.toISOString()).toBe(new Date('2026-10-30T04:00:00+07:00').toISOString())
    await attendance.aggregateDailyAttendance(10, 2026, emp.id)
    const summary = await db.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: emp.id, work_date: new Date(`${date}T00:00:00Z`) } } })
    expect(Number(summary.total_working_hours)).toBe(8)
    expect((await payroll.generate('2026-10', emp.id, admin.id, admin))[0].total_working_hours).toBe(8)
  })

  it('assigns and calculates an overnight month-end shift using the starting work date', async () => {
    const emp = await employee('night')
    await shifts.assignOrUpdate({ employee_id: emp.id, date: '2026-10-31', shift_type: 'OTHER', start_time: '22:00', end_time: '06:00' }, admin.id, 'ADMIN')
    await db.attendance_logs.createMany({ data: [
      { employee_id: emp.id, type: 'CHECK_IN', event_time: new Date('2026-10-31T22:00:00+07:00'), status: 'VALID', method: 'FACE' },
      { employee_id: emp.id, type: 'CHECK_OUT', event_time: new Date('2026-11-01T06:00:00+07:00'), status: 'VALID', method: 'FACE' },
    ] })
    vi.setSystemTime(new Date('2026-11-01T07:00:00+07:00'))
    await attendance.aggregateDailyAttendance(10, 2026, emp.id)
    const summary = await db.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: emp.id, work_date: new Date('2026-10-31T00:00:00Z') } } })
    expect(Number(summary.total_working_hours)).toBe(8)
    expect(summary.requires_review).toBe(false)
    expect((await payroll.generate('2026-10', emp.id, admin.id, admin))[0].total_working_hours).toBe(8)
  })
})
