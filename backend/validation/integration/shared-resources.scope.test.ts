import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({
  device: {
    create: () => { throw new Error('Unexpected database write before authorization') },
    findUnique: () => { throw new Error('Unexpected database read before authorization') },
  },
  employee: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  payrollRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  daily_attendance_summary: {
    findMany: vi.fn(async () => []),
  },
  attendanceAdjustment: {
    findMany: vi.fn(async () => []),
  },
  employee_shifts: {
    findMany: vi.fn(async () => []),
  },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
import { positionRouter } from '../../src/modules/employees/position.routes.js'
import { shiftRouter } from '../../src/modules/shifts/shift.routes.js'
import * as devices from '../../src/modules/devices/device.service.js'
import * as employeePublic from '../../src/modules/employees/public.js'
import * as payrollService from '../../src/modules/payroll/payroll.service.js'

describe('global resources require Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it.each([
    [positionRouter, '/', 'post'], [positionRouter, '/:id', 'put'], [shiftRouter, '/templates', 'post'],
  ])('rejects manager catalog mutations before entering controllers', (router, path, method) => {
    const route = (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method as string]).route
    let error: any
    route.stack[0].handle({ user: { id: 'manager', role: 'MANAGER' } }, {}, (value: any) => { error = value })
    expect(error?.statusCode).toBe(403)
  })
  it('rejects manager shared-device writes and control in the service as well', async () => {
    for (const action of [
      () => devices.create({ name: 'shared', location: 'gate' }, 'manager', 'MANAGER'),
      () => devices.update('shared', { name: 'changed' }, 'manager', 'MANAGER'),
      () => devices.setDeviceAttendanceMode('shared', 'CHECK_OUT', 'MANAGER'),
    ]) await expect(action()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('short-circuits getManagedEmployeeIds on empty input without touching the database', async () => {
    const getManagedEmployeeIds = (employeePublic as any).getManagedEmployeeIds
    expect(typeof getManagedEmployeeIds).toBe('function')
    const result = await getManagedEmployeeIds({ id: 'mgr-user', role: 'MANAGER' }, [])
    expect(result).toEqual(new Set())
    expect(db.employee.findFirst).not.toHaveBeenCalled()
    expect(db.employee.findMany).not.toHaveBeenCalled()
  })

  it('computes payroll list scope and per-record can_edit from backend authority and preserves historical records across hire-date checks', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'emp-mgr', departmentId: 10 })
    db.employee.findMany
      // 1st call: getEmployeeScope('read') colleagues
      .mockResolvedValueOnce([
        { id: 'emp-mgr', position: { name: 'Trưởng phòng', level: 'MANAGER' }, department: { name: 'IT' }, users: { roles: { role_name: 'MANAGER' } } },
        { id: 'emp-sub', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
        { id: 'emp-future-pending', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
        { id: 'emp-future-finalized', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
      ])
      // 2nd call: getEmployeeScope('manage') colleagues inside getManagedEmployeeIds
      .mockResolvedValueOnce([
        { id: 'emp-mgr', position: { name: 'Trưởng phòng', level: 'MANAGER' }, department: { name: 'IT' }, users: { roles: { role_name: 'MANAGER' } } },
        { id: 'emp-sub', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
        { id: 'emp-future-finalized', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
      ])
      // 3rd call: getManagedEmployeeIds single AND query against manage scope
      .mockImplementationOnce(async ({ where }: any) => {
        const manageScopeIds: string[] = where?.AND?.[0]?.id?.in || []
        const requestedIds: string[] = where?.AND?.[1]?.id?.in || []
        return requestedIds.filter(id => manageScopeIds.includes(id)).map(id => ({ id }))
      })

    db.payrollRecord.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        payroll_period: '2026-10',
        employeeId: 'emp-mgr',
        hourly_rate: 100000,
        total_working_hours: 160,
        total_overtime: 0,
        total_late_early: 0,
        total_absence_penalty: 0,
        allowance: 0,
        net_salary: 16000000,
        overtime_rate: 2,
        late_penalty_rate: 1.5,
        status: 'PENDING',
        calculation_details: { rate_snapshot_status: 'MULTIPLIER' },
        employee: { id: 'emp-mgr', employee_code: 'MGR01', full_name: 'Manager Self', createdAt: new Date('2026-01-10T00:00:00Z'), department: { name: 'IT' } },
      },
      {
        id: 2n,
        payroll_period: '2026-10',
        employeeId: 'emp-sub',
        hourly_rate: 80000,
        total_working_hours: 160,
        total_overtime: 0,
        total_late_early: 0,
        total_absence_penalty: 0,
        allowance: 0,
        net_salary: 12800000,
        overtime_rate: 2,
        late_penalty_rate: 1.5,
        status: 'PENDING',
        calculation_details: { rate_snapshot_status: 'MULTIPLIER' },
        employee: { id: 'emp-sub', employee_code: 'EMP01', full_name: 'Subordinate', createdAt: new Date('2026-05-10T00:00:00Z'), department: { name: 'IT' } },
      },
      {
        id: 3n,
        payroll_period: '2026-10',
        employeeId: 'emp-future-pending',
        hourly_rate: 80000,
        total_working_hours: 0,
        total_overtime: 0,
        total_late_early: 0,
        total_absence_penalty: 0,
        allowance: 0,
        net_salary: 0,
        overtime_rate: 2,
        late_penalty_rate: 1.5,
        status: 'PENDING',
        calculation_details: { rate_snapshot_status: 'MULTIPLIER' },
        employee: { id: 'emp-future-pending', employee_code: 'EMP02', full_name: 'Future Hire Pending', createdAt: new Date('2026-11-05T00:00:00Z'), department: { name: 'IT' } },
      },
      {
        id: 4n,
        payroll_period: '2026-10',
        employeeId: 'emp-future-finalized',
        hourly_rate: 80000,
        total_working_hours: 100,
        total_overtime: 0,
        total_late_early: 0,
        total_absence_penalty: 0,
        allowance: 0,
        net_salary: 8000000,
        overtime_rate: 2,
        late_penalty_rate: 1.5,
        status: 'FINALIZED',
        calculation_details: { rate_snapshot_status: 'MULTIPLIER' },
        employee: { id: 'emp-future-finalized', employee_code: 'EMP03', full_name: 'Historical Finalized', createdAt: new Date('2026-11-05T00:00:00Z'), department: { name: 'IT' } },
      },
    ])

    const rows = await payrollService.list('2026-10', undefined, { id: 'mgr-user', role: 'MANAGER' })
    expect(rows.map((r: any) => ({ employee_id: r.employee_id, can_edit: r.can_edit }))).toEqual([
      { employee_id: 'MGR01', can_edit: false },
      { employee_id: 'EMP01', can_edit: true },
      { employee_id: 'EMP03', can_edit: false },
    ])
  })
})
