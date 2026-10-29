import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  attendance_logs: { findMany: vi.fn(), groupBy: vi.fn() }, daily_attendance_summary: { findMany: vi.fn() },
  employee_shifts: { findMany: vi.fn() }, auditLog: { create: vi.fn() }, $executeRaw: vi.fn(), $transaction: vi.fn(),
  user: { findFirst: vi.fn(), create: vi.fn() }, roles: { findFirst: vi.fn() },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
import { assertCanAccessEmployeeDetail, assertCanManageEmployee, getEmployeeScope } from '../../src/modules/employees/employee.permission.js'
import { toggleLock } from '../../src/modules/attendance/attendance.service.js'
import * as attendance from '../../src/modules/attendance/attendance.service.js'
import * as shifts from '../../src/modules/shifts/shift.service.js'
import * as employees from '../../src/modules/employees/employee.service.js'
import * as biometrics from '../../src/modules/biometrics/biometric.service.js'

const manager = { id: 'manager-user', role: 'MANAGER' }
const self = { id: 'manager', user_id: manager.id, employee_code: 'M1', departmentId: 1, status: 'ACTIVE' }
const staff = { id: 'staff', user_id: 'staff-user', employee_code: 'S1', departmentId: 1, status: 'ACTIVE' }
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(v => matches(row, v))
    if (key === 'OR') return value.some((v: any) => matches(row, v))
    if (key === 'NOT') return !matches(row, value)
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key])
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not
    return row[key] === value
  })
}
let rows: any[]
beforeEach(() => {
  vi.clearAllMocks()
  rows = [self, staff, { ...staff, id: 'other', employee_code: 'O1', departmentId: 2 },
    { ...staff, id: 'unassigned', employee_code: 'U1', departmentId: null },
    { ...staff, id: 'peer', users: { roles: { role_name: 'MANAGER' } } },
    { ...staff, id: 'boss', position: { level: 'MANAGER' } },
    { ...staff, id: 'admin', users: { roles: { role_name: 'ADMIN' } } }]
  db.employee.findFirst.mockImplementation(async ({ where }) => rows.find(row => matches(row, where)) || null)
  db.employee.findMany.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)))
  db.employee.count.mockResolvedValue(0)
  db.employee.update.mockResolvedValue({ ...staff, full_name: 'updated' }); db.$executeRaw.mockResolvedValue(1)
  db.user.findFirst.mockResolvedValue(null); db.roles.findFirst.mockResolvedValue({ id: 1, role_name: 'EMPLOYEE' })
  db.attendance_logs.findMany.mockResolvedValue([]); db.attendance_logs.groupBy.mockResolvedValue([])
  db.daily_attendance_summary.findMany.mockResolvedValue([]); db.employee_shifts.findMany.mockResolvedValue([])
  db.$transaction.mockImplementation(async input => typeof input === 'function' ? input(db) : Promise.all(input))
})
describe('employee department authorization', () => {
  it('saves the previous and current monthly wage in the same employee update', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'))
    try {
      rows[1].hourly_rate = 100000
      db.employee.update.mockResolvedValue({ ...rows[1], hourly_rate: 120000 })
      await employees.updateWithManagerCheck('S1', { hourly_rate: 120000 }, { id: 'admin-user', role: 'ADMIN' })
      expect(db.employee.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hourly_rate: 120000, hourly_rate_history: [{ period: '0000-01', rate: 100000 }, { period: '2026-10', rate: 120000 }] }) }))
    } finally { vi.useRealTimers() }
  })
  it('reads only self and ordinary staff in the current department', async () => {
    const scope = await getEmployeeScope(manager)
    expect(rows.filter(row => matches(row, scope)).map(row => row.id)).toEqual(['manager', 'staff'])
    await expect(assertCanAccessEmployeeDetail(manager, 'O1')).rejects.toMatchObject({ statusCode: 403 })
    await expect(assertCanAccessEmployeeDetail(manager, 'U1')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('manages ordinary department staff but never self, managers, admins or unassigned staff', async () => {
    const scope = await getEmployeeScope(manager, 'manage')
    expect(rows.filter(row => matches(row, scope)).map(row => row.id)).toEqual(['staff'])
    await expect(assertCanManageEmployee(manager, 'S1')).resolves.toBeUndefined()
    for (const target of ['M1', 'other', 'peer', 'boss', 'admin', 'unassigned']) {
      await expect(assertCanManageEmployee(manager, target)).rejects.toMatchObject({ statusCode: 403 })
    }
  })
  it('denies management with no department while keeping the own profile readable', async () => {
    rows[0] = { ...self, departmentId: null }
    const scope = await getEmployeeScope(manager, 'manage')
    expect(rows.filter(row => matches(row, scope))).toEqual([])
    await expect(assertCanAccessEmployeeDetail(manager, 'M1')).resolves.toBeUndefined()
    await expect(assertCanManageEmployee(manager, 'U1')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('ignores forged employee claims and limits employees to their database profile', async () => {
    const actor = { id: 'staff-user', role: 'EMPLOYEE', employeeId: 'other' }
    const scope = await getEmployeeScope(actor)
    expect(rows.filter(row => matches(row, scope)).map(row => row.id)).toEqual(['staff'])
    await expect(assertCanManageEmployee(actor, 'S1')).rejects.toMatchObject({ statusCode: 403 })
    await expect(getEmployeeScope({ id: 'unknown', role: 'AUDITOR' })).rejects.toMatchObject({ statusCode: 403 })
    expect(await getEmployeeScope({ role: 'ADMIN' })).toEqual({})
  })
  it('rejects manager global locking and unlocking before reading or changing attendance', async () => {
    for (const locked of [false, true]) await expect(toggleLock('2026-10-01', locked, manager.id, manager.role)).rejects.toMatchObject({ statusCode: 403 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('rejects cross-department controls through every employee mutation entry point', async () => {
    const denied = [
      () => shifts.assignOrUpdateWithPermissionCheck({ employee_id: 'O1', date: '2026-10-01', shift_type: 'OFF' }, manager),
      () => employees.updateWithManagerCheck('O1', { full_name: 'changed' }, manager),
      () => employees.resetPassword('O1', manager.id, manager.role),
      () => biometrics.enrollImagesWithPermissionCheck('O1', ['image'], manager),
      () => biometrics.removeAllWithPermissionCheck('O1', manager),
      () => biometrics.deactivate('O1', manager),
      () => attendance.checkIn({ employeeId: 'O1' }, manager),
      () => attendance.checkOut('O1', undefined, manager),
    ]
    for (const action of denied) await expect(action()).rejects.toMatchObject({ statusCode: 403 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('scopes attendance lists, summaries, statistics, shifts and employee lists before querying', async () => {
    await attendance.list({}, manager); await attendance.getDailySummaries({}, manager)
    await attendance.statistics(manager); await shifts.list({}, manager); await employees.list({}, manager)
    for (const query of [db.attendance_logs.findMany, db.attendance_logs.groupBy, db.daily_attendance_summary.findMany, db.employee_shifts.findMany]) {
      const where = query.mock.calls[0][0].where.employees
      expect(rows.filter(row => matches(row, where)).map(row => row.id)).toEqual(['manager', 'staff'])
    }
    const employeeWhere = db.employee.findMany.mock.lastCall![0].where
    expect(rows.filter(row => matches(row, employeeWhere)).map(row => row.id)).toEqual(['manager', 'staff'])
  })
  it('intersects an explicit aggregate target with the supplied management scope', async () => {
    const result = await attendance.aggregateDailyAttendance(10, 2026, 'O1', undefined, await getEmployeeScope(manager, 'manage'))
    expect(result.totalSummaries).toBe(0)
    expect(db.attendance_logs.findMany).not.toHaveBeenCalled()
  })
  it('rejects department changes and manager creation with no department', async () => {
    await expect(employees.updateWithManagerCheck('S1', { departmentId: 2 }, manager)).rejects.toMatchObject({ statusCode: 403 })
    rows[0] = { ...self, departmentId: null }
    await expect(employees.createWithManagerCheck({ full_name: 'new' }, manager.id, manager.role)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rechecks management against locked transaction rows after a department change', async () => {
    const movedRows = rows.map(row => row.id === self.id ? { ...row, departmentId: 2 } : row)
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      employee: {
        findFirst: vi.fn(async ({ where }) => movedRows.find(row => matches(row, where)) || null),
        findMany: vi.fn(async ({ where }) => movedRows.filter(row => matches(row, where))),
      },
    }
    await expect(assertCanManageEmployee(manager, 'S1', tx as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })
  it('locks the current management scope during an allowed employee update', async () => {
    const result = await employees.updateWithManagerCheck('S1', { full_name: 'updated' }, manager)
    expect(result.full_name).toBe('updated')
    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
  })
  it('rechecks the manager department before creating the employee account', async () => {
    db.$transaction.mockImplementation(async callback => {
      rows[0] = { ...self, departmentId: 2 }
      return callback(db)
    })
    await expect(employees.createWithManagerCheck({ full_name: 'new', employee_code: 'NEW' }, manager.id, manager.role)).rejects.toMatchObject({ statusCode: 403 })
    expect(db.user.create).not.toHaveBeenCalled()
  })
  it('never falls back to an Admin role when creating an ordinary employee', async () => {
    db.roles.findFirst.mockResolvedValue({ id: 1, role_name: 'ADMIN' })
    await expect(employees.createWithManagerCheck({ full_name: 'new', employee_code: 'NEW' }, manager.id, manager.role)).rejects.toMatchObject({ statusCode: 500 })
    expect(db.user.create).not.toHaveBeenCalled()
  })
})
