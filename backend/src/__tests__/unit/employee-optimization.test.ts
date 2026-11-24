import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  employeeFindFirst: vi.fn(),
  employeeFindMany: vi.fn(),
  employeeCount: vi.fn(),
  employeeCreate: vi.fn(),
  employeeUpdate: vi.fn(),
  userCreate: vi.fn(),
  roleFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  executeRaw: vi.fn(async () => 0),
  positionFindUnique: vi.fn(),
  positionFindFirst: vi.fn(),
  departmentFindFirst: vi.fn(),
  findOperationByKey: vi.fn(),
  enqueueOperation: vi.fn(),
}))

vi.mock('../../config/database.js', () => ({
  prisma: {
    employee: {
      findFirst: mocks.employeeFindFirst,
      findMany: mocks.employeeFindMany,
      count: mocks.employeeCount,
      create: mocks.employeeCreate,
      update: mocks.employeeUpdate,
    },
    user: { create: mocks.userCreate, findFirst: vi.fn(async () => null) },
    roles: { findFirst: mocks.roleFindFirst },
    position: { findUnique: mocks.positionFindUnique, findFirst: mocks.positionFindFirst },
    department: { findFirst: mocks.departmentFindFirst, findUnique: vi.fn(async () => ({ id: 5, name: 'IT' })) },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: vi.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg({
        $executeRaw: mocks.executeRaw,
        employee: {
          findFirst: mocks.employeeFindFirst,
          findMany: mocks.employeeFindMany,
          create: mocks.employeeCreate,
          update: mocks.employeeUpdate,
        },
        user: { create: mocks.userCreate, findFirst: vi.fn(async () => null) },
        roles: { findFirst: mocks.roleFindFirst },
        position: { findUnique: mocks.positionFindUnique, findFirst: mocks.positionFindFirst },
        department: { findFirst: mocks.departmentFindFirst, findUnique: vi.fn(async () => ({ id: 5, name: 'IT' })) },
        auditLog: { create: mocks.auditLogCreate },
      })
    }),
  },
}))

vi.mock('../../modules/operations/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/operations/public.js')>()
  return {
    ...actual,
    findOperationByKey: mocks.findOperationByKey,
    enqueueOperation: mocks.enqueueOperation,
  }
})

vi.mock('../../modules/employees/employee.integration-port.js', () => ({
  faceEnrollmentSummarySelect: () => ({ select: { id: true, is_active: true } }),
  hasActiveFaceEnrollment: (rows: any[]) => Array.isArray(rows) && rows.some((r) => r.is_active),
  employeeIntegration: () => ({
    updateAuthUser: vi.fn(),
  }),
}))

import { resolveManagedEmployee } from '../../modules/employees/employee.permission.js'
import { updateWithManagerCheck, list, get, create, formatEmployee } from '../../modules/employees/employee.service.js'
import { employeeInclude, employeeListInclude } from '../../modules/employees/employee.model.js'

const normalizeJson = (val: unknown) => JSON.parse(JSON.stringify(val))

describe('Task 4: Employee permission contract, CRUD/list optimization & normalized JSON contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.employeeFindFirst.mockReset()
    mocks.employeeFindMany.mockReset()
    mocks.employeeCount.mockReset()
    mocks.employeeCreate.mockReset()
    mocks.employeeUpdate.mockReset()
    mocks.findOperationByKey.mockReset()
  })

  it('resolveManagedEmployee preserves 404 for ADMIN and 403 for MANAGER in 1 employee query', async () => {
    mocks.employeeFindFirst.mockResolvedValueOnce(null)
    await expect(resolveManagedEmployee({ id: 'adm-1', role: 'ADMIN' }, 'NV-MISSING'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.employeeFindFirst).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    mocks.employeeFindFirst.mockResolvedValueOnce({ id: 'mgr-emp', departmentId: 5 })
    mocks.employeeFindMany.mockResolvedValueOnce([])
    mocks.employeeFindFirst.mockResolvedValueOnce(null)
    await expect(resolveManagedEmployee({ id: 'mgr-user', role: 'MANAGER' }, 'NV-OTHER'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('guarantees 100% normalized JSON parity (fields, values & key order) between list (employeeListInclude), get (employeeInclude), update, and create idempotent replay', async () => {
    expect('employee_shifts' in employeeListInclude).toBe(false)
    expect('employee_shifts' in employeeInclude).toBe(true)

    const baseRow = {
      id: '11111111-1111-4111-8111-111111111111',
      employee_code: 'NV-001',
      full_name: 'Nguyen Van A',
      email: 'a@test.local',
      phone: '0901234567',
      positionId: 2,
      departmentId: 5,
      status: 'ACTIVE',
      hourly_rate: 55000,
      hourly_rate_history: [{ period: '2026-01', rate: 55000 }],
      avatar_url: 'data:image/jpeg;base64,AAA',
      fingerprint_enrolled: true,
      user_id: 'u-1',
      createdAt: new Date('2026-01-15T08:00:00.000Z'),
      updatedAt: new Date('2026-11-20T09:30:00.000Z'),
      department: { id: 5, name: 'IT' },
      position: { id: 2, name: 'Developer', level: 'EMPLOYEE', position_code: 'DEV' },
      users: { id: 'u-1', username: 'nv001', is_active: true, roles: { role_name: 'EMPLOYEE' } },
      face_embeddings: [{ id: 'vec-1', is_active: true }],
    }

    const fullRowWithShifts = {
      ...baseRow,
      employee_shifts: [{ id: 10n, work_date: new Date('2026-11-24T00:00:00Z'), work_shifts: { id: 1 } }],
    }

    // 1. list (employeeListInclude) vs get (employeeInclude)
    mocks.employeeFindMany.mockResolvedValueOnce([baseRow])
    mocks.employeeCount.mockResolvedValueOnce(1)
    const listRes = await list({ page: '1', limit: '20' }, { id: 'adm-1', role: 'ADMIN' })
    expect(mocks.employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: employeeListInclude }))

    mocks.employeeFindFirst.mockResolvedValueOnce(fullRowWithShifts)
    const detailRes = await get(baseRow.id)
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith(expect.objectContaining({ include: employeeInclude }))

    expect(normalizeJson(listRes.items[0])).toEqual(normalizeJson(detailRes))
    expect(Object.keys(listRes.items[0])).toEqual(Object.keys(detailRes))
    expect(Object.keys(listRes.items[0])).toEqual(Object.keys(formatEmployee(fullRowWithShifts)))

    // 2. updateWithManagerCheck checks scope once inside tx and returns identical JSON contract
    mocks.employeeFindFirst.mockClear()
    mocks.employeeFindFirst.mockResolvedValueOnce(baseRow)
    mocks.employeeUpdate.mockResolvedValueOnce(baseRow)
    mocks.auditLogCreate.mockResolvedValueOnce({ id: 1n })

    const updatedRes = await updateWithManagerCheck(baseRow.id, { full_name: 'Nguyen Van A' }, { id: 'adm-1', role: 'ADMIN' })
    expect(mocks.employeeFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.employeeFindFirst.mock.calls[0][0].select).toBeDefined()
    expect(mocks.employeeFindFirst.mock.calls[0][0].include).toBeUndefined()
    expect(normalizeJson(updatedRes)).toEqual(normalizeJson(detailRes))

    // 3. create idempotent replay uses get() (employeeInclude) and preserves contract
    mocks.findOperationByKey.mockResolvedValueOnce({ result: { employeeId: baseRow.id } })
    mocks.employeeFindFirst.mockResolvedValueOnce(fullRowWithShifts)
    const replayCreate = await create(
      { full_name: 'Nguyen Van A', email: 'a@test.local', departmentId: 5, positionId: 2 },
      'adm-1',
      'ADMIN',
      { key: '33333333-3333-4333-8333-333333333333', fingerprint: { email: 'a@test.local' } },
    )
    const { email_status, initial_account: _ia, ...replayEmployeeFields } = replayCreate as any
    expect(email_status).toBe('queued')
    expect(normalizeJson(replayEmployeeFields)).toEqual(normalizeJson(detailRes))
  })
})
