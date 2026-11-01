import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip
suite('Missing-scan notifications on isolated Neon', () => {
  let db: any, alerts: any, admin: any, manager: any, outsider: any, department: any, shift: any
  const user = async (role: string) => db.user.create({ data: { username: `alert-${randomUUID()}`, passwordHash: 'test', role_id: (await db.roles.findUnique({ where: { role_name: role } })).id } })
  const employee = async (date: string, assignedShift = shift) => {
    const account = await user('EMPLOYEE')
    const person = await db.employee.create({ data: { employee_code: `ALERT-${randomUUID()}`, full_name: 'Synthetic alert', user_id: account.id, departmentId: department.id } })
    await db.employee_shifts.create({ data: { employee_id: person.id, shift_id: assignedShift.id, work_date: new Date(`${date}T00:00:00Z`), start_time: assignedShift.start_time, end_time: assignedShift.end_time } })
    return { person, account }
  }
  const log = (person: any, type: string, at: string, workDate: string, status = 'VALID') => db.attendance_logs.create({ data: { employee_id: person.id, type, event_time: new Date(at), work_date: new Date(`${workDate}T00:00:00Z`), status, method: 'MANUAL' } })
  const checkpoint = (at: string) => db.attendanceAlertCheckpoint.update({ where: { name: 'missing_shift_scans' }, data: { last_due_at: new Date(at) } })
  beforeAll(async () => {
    db = (await import('../../src/config/database.js')).prisma
    alerts = await import('../../src/modules/attendance/attendance.missing-alerts.js')
    admin = await user('ADMIN'); manager = await user('MANAGER'); outsider = await user('MANAGER')
    department = await db.department.create({ data: { department_code: `ALERT-${randomUUID()}`, name: 'Synthetic' } })
    const other = await db.department.create({ data: { department_code: `OTHER-${randomUUID()}`, name: 'Other' } })
    for (const [account, dept] of [[manager, department], [outsider, other]]) await db.employee.create({ data: { employee_code: `M-${randomUUID()}`, full_name: 'Manager', user_id: account.id, departmentId: dept.id } })
    shift = await db.work_shifts.create({ data: { shift_name: `Day ${randomUUID()}`, start_time: new Date('1970-01-01T08:00:00Z'), end_time: new Date('1970-01-01T17:00:00Z') } })
  })
  afterAll(async () => { if (db) await db.$disconnect() })
  it('sends one scoped alert for each missing category after the grace period', async () => {
    const date = '2026-10-30'
    const [onlyIn, onlyOut, none, complete] = await Promise.all([employee(date), employee(date), employee(date), employee(date)])
    await log(onlyIn.person, 'CHECK_IN', `${date}T08:00:00+07:00`, date)
    await log(onlyOut.person, 'CHECK_OUT', `${date}T17:00:00+07:00`, date)
    await log(complete.person, 'CHECK_IN', `${date}T08:00:00+07:00`, date)
    await log(complete.person, 'CHECK_OUT', `${date}T17:00:00+07:00`, date)
    await checkpoint(`${date}T17:00:00+07:00`)
    await alerts.runMissingScanAlerts(new Date(`${date}T17:29:59+07:00`))
    expect(await db.systemNotification.count()).toBe(0)
    await alerts.runMissingScanAlerts(new Date(`${date}T17:30:00+07:00`))
    const all = await db.systemNotification.findMany({ orderBy: { id: 'asc' } })
    expect(all).toHaveLength(9)
    for (const fixture of [onlyIn, onlyOut, none]) expect(all.filter((n: any) => n.employee_id === fixture.person.id).map((n: any) => n.user_id).sort()).toEqual([admin.id, manager.id, fixture.account.id].sort())
    expect(all.some((n: any) => n.user_id === outsider.id)).toBe(false)
    expect(all.find((n: any) => n.employee_id === onlyIn.person.id).message).toContain('check-out')
    expect(all.find((n: any) => n.employee_id === onlyOut.person.id).message).toContain('check-in')
    expect(all.find((n: any) => n.employee_id === none.person.id).message).toContain('check-in và check-out')
    await checkpoint(`${date}T17:00:00+07:00`)
    await Promise.all([alerts.runMissingScanAlerts(new Date(`${date}T17:31:00+07:00`)), alerts.runMissingScanAlerts(new Date(`${date}T17:31:00+07:00`))])
    expect(await db.systemNotification.count()).toBe(9)
    expect(await db.daily_attendance_summary.count()).toBe(0)
    expect(await db.attendanceAdjustment.count()).toBe(0)
    expect(await db.payrollRecord.count()).toBe(0)
  })
  it('handles an overnight checkout recorded on the next calendar day', async () => {
    const night = await db.work_shifts.create({ data: { shift_name: `Night ${randomUUID()}`, start_time: new Date('1970-01-01T22:00:00Z'), end_time: new Date('1970-01-01T06:00:00Z') } })
    const onlyOut = await employee('2026-10-30', night)
    await log(onlyOut.person, 'CHECK_OUT', '2026-10-31T06:00:00+07:00', '2026-10-31')
    await checkpoint('2026-10-31T06:00:00+07:00')
    await alerts.runMissingScanAlerts(new Date('2026-10-31T06:30:00+07:00'))
    const notice = await db.systemNotification.findFirst({ where: { employee_id: onlyOut.person.id, user_id: admin.id } })
    expect(notice.message).toContain('check-in')
    expect(notice.message).not.toContain('check-in và check-out')
  })
})
