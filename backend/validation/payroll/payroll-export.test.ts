import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  payrollRecord: {
    findMany: vi.fn(),
  },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

import { payrollRouter } from '../../src/modules/payroll/payroll.routes.js'
import * as payrollController from '../../src/modules/payroll/payroll.controller.js'

const makeRecord = (overrides: Record<string, any> = {}) => ({
  id: 10n,
  payroll_period: '2026-10',
  employeeId: 'emp-1',
  hourly_rate: 100000,
  total_working_hours: 160,
  total_overtime: 4,
  total_late_early: 0,
  total_absence_penalty: 0,
  allowance: 500000,
  net_salary: 17300000,
  overtime_rate: 2,
  late_penalty_rate: 1.5,
  status: 'FINALIZED',
  calculation_details: { rate_snapshot_status: 'MULTIPLIER' },
  employee: {
    id: 'emp-1',
    employee_code: 'EMP001',
    full_name: 'Nguyen Van A',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    department: { name: 'IT' },
  },
  ...overrides,
})

describe('Payroll official export endpoint and service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.employee.findFirst.mockResolvedValue({ id: 'emp-mgr', departmentId: 1 })
    db.employee.findMany.mockResolvedValue([
      { id: 'emp-mgr', position: { name: 'Manager', level: 'MANAGER' }, department: { name: 'IT' }, users: { roles: { role_name: 'MANAGER' } } },
      { id: 'emp-1', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
      { id: 'emp-2', position: { name: 'Dev', level: 'STAFF' }, department: { name: 'IT' }, users: { roles: { role_name: 'EMPLOYEE' } } },
    ])
  })

  it('registers POST /period/:period/export with ADMIN and MANAGER role authorization', () => {
    const layer = (payrollRouter as any).stack.find(
      (l: any) => l.route?.path === '/period/:period/export' && l.route.methods.post
    )
    expect(layer).toBeDefined()
    let forbiddenError: any
    layer.route.stack[0].handle({ user: { id: 'emp-user', role: 'EMPLOYEE' } }, {}, (err: any) => {
      forbiddenError = err
    })
    expect(forbiddenError?.statusCode).toBe(403)
  })

  it('returns 400 when period format is invalid or recordIds is empty', async () => {
    const { buildPayrollExport } = await import('../../src/modules/payroll/payroll.export.js')
    await expect(
      buildPayrollExport('2026-13', { id: 'admin', role: 'ADMIN' }, ['10'])
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      buildPayrollExport('2026-10', { id: 'admin', role: 'ADMIN' }, [])
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 409 when period only has early-settlement payslips', async () => {
    const { buildPayrollExport } = await import('../../src/modules/payroll/payroll.export.js')
    db.payrollRecord.findMany.mockResolvedValueOnce([
      makeRecord({
        id: 11n,
        status: 'FINALIZED',
        calculation_details: {
          rate_snapshot_status: 'MULTIPLIER',
          early_settlement: { is_early_settlement: true },
        },
      }),
    ])
    await expect(
      buildPayrollExport('2026-10', { id: 'mgr', role: 'MANAGER' }, ['11'])
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when any readable payslip in the period is PENDING (including manager self or reopened period)', async () => {
    const { buildPayrollExport } = await import('../../src/modules/payroll/payroll.export.js')
    db.payrollRecord.findMany.mockResolvedValueOnce([
      makeRecord({ id: 10n, employeeId: 'emp-1', status: 'FINALIZED' }),
      makeRecord({
        id: 12n,
        employeeId: 'emp-mgr',
        status: 'PENDING',
        employee: { id: 'emp-mgr', employee_code: 'MGR001', full_name: 'Manager Self', department: { name: 'IT' } },
      }),
    ])
    // Even if the UI filter only requested subordinate record '10' (which is FINALIZED),
    // the readable period still has a PENDING record ('12'), so export must reject with 409.
    await expect(
      buildPayrollExport('2026-10', { id: 'mgr', role: 'MANAGER' }, ['10'])
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns 404 when period is eligible in actor read scope but requested recordIds are all outside actor scope', async () => {
    const { buildPayrollExport } = await import('../../src/modules/payroll/payroll.export.js')
    db.payrollRecord.findMany.mockResolvedValueOnce([
      makeRecord({ id: 10n, employeeId: 'emp-1', status: 'FINALIZED' }),
    ])
    await expect(
      buildPayrollExport('2026-10', { id: 'mgr', role: 'MANAGER' }, ['999', 'PR-202610-999'])
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns only the intersection of eligible scoped records and requested recordIds with employee_name and export columns', async () => {
    const { buildPayrollExport } = await import('../../src/modules/payroll/payroll.export.js')
    db.payrollRecord.findMany.mockResolvedValueOnce([
      makeRecord({ id: 10n, employeeId: 'emp-1', status: 'FINALIZED' }),
      makeRecord({
        id: 11n,
        employeeId: 'emp-2',
        status: 'PAID',
        net_salary: 19000000,
        employee: { id: 'emp-2', employee_code: 'EMP002', full_name: 'Tran Thi B', department: { name: 'IT' } },
      }),
    ])

    const exported = await buildPayrollExport('2026-10', { id: 'mgr', role: 'MANAGER' }, ['PR-202610-011', '999'])
    expect(exported).toHaveLength(1)
    expect(exported[0]).toMatchObject({
      id: '11',
      payroll_id: 'PR-202610-011',
      employee_id: 'EMP002',
      employee_name: 'Tran Thi B',
      department: 'IT',
      period: '2026-10',
      net_salary: 19000000,
      status: 'PAID',
    })
    expect(typeof (payrollController as any).exportPeriod).toBe('function')
  })
})
