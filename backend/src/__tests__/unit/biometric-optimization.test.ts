import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../../common/AppError.js'

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  auditLogCreate: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  resolveManagedEmployee: vi.fn(),
  findEmployeeByIdOrCode: vi.fn(),
  assertCanManageEmployee: vi.fn(),
  enqueueOperation: vi.fn(),
  stagedInput: vi.fn(),
  currentActor: vi.fn(),
}))

vi.mock('../../config/database.js', () => ({
  prisma: {
    face_embeddings: { count: mocks.count, findFirst: mocks.findFirst },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: vi.fn(async (fn: any) => fn({
      face_embeddings: {
        findFirst: mocks.findFirst,
        updateMany: mocks.updateMany,
        deleteMany: mocks.deleteMany,
      },
      auditLog: { create: mocks.auditLogCreate },
      $queryRaw: mocks.queryRaw,
      $executeRaw: mocks.executeRaw,
    })),
  },
}))

vi.mock('../../modules/employees/public.js', () => ({
  resolveManagedEmployee: mocks.resolveManagedEmployee,
  findEmployeeByIdOrCode: mocks.findEmployeeByIdOrCode,
  assertCanManageEmployee: mocks.assertCanManageEmployee,
}))

vi.mock('../../modules/operations/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/operations/public.js')>()
  return {
    ...actual,
    enqueueOperation: mocks.enqueueOperation,
    stagedInput: mocks.stagedInput,
    currentActor: mocks.currentActor,
  }
})

import { deactivate, removeAllWithPermissionCheck } from '../../modules/biometrics/biometric.service.js'
import { submitEnrollment, executeEnrollment } from '../../modules/biometrics/biometric.jobs.js'
import { env } from '../../config/env.js'

describe('Task 3: Biometrics HTTP status matrix (404/409/403), atomic lock, & receipt replay', () => {
  const empId = '11111111-1111-4111-8111-111111111111'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.count.mockReset()
    mocks.findFirst.mockReset()
    mocks.updateMany.mockReset()
    mocks.deleteMany.mockReset()
    mocks.auditLogCreate.mockReset()
    mocks.queryRaw.mockReset()
    mocks.executeRaw.mockReset()
    mocks.resolveManagedEmployee.mockReset()
    mocks.findEmployeeByIdOrCode.mockReset()
    mocks.assertCanManageEmployee.mockReset()
    mocks.executeRaw.mockResolvedValue(1)
    mocks.queryRaw.mockResolvedValue([]) // default: no active enrollment job
  })

  it('deactivate & DELETE return 404 (not 409) when no matching vectors exist even if an enrollment job is queued/running', async () => {
    mocks.resolveManagedEmployee.mockResolvedValue({
      id: empId, employee_code: 'NV-001', status: 'ACTIVE', user_id: null, departmentId: 5,
    })

    // Active enrollment job exists, but NO active vectors exist for deactivate -> must return 404
    mocks.queryRaw.mockResolvedValueOnce([{ id: 'job-enrolling-1' }])
    mocks.findFirst.mockResolvedValueOnce(null)
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(deactivate('NV-001', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.updateMany).not.toHaveBeenCalled()

    // Active enrollment job exists, and NO vectors at all exist for DELETE -> must return 404
    mocks.queryRaw.mockResolvedValueOnce([{ id: 'job-enrolling-1' }])
    mocks.findFirst.mockResolvedValueOnce(null)
    mocks.deleteMany.mockResolvedValueOnce({ count: 0 })

    await expect(removeAllWithPermissionCheck('NV-001', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.deleteMany).not.toHaveBeenCalled()
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })

  it('deactivate & DELETE return 409 without mutating vectors when matching vectors exist AND an enrollment job is active', async () => {
    mocks.resolveManagedEmployee.mockResolvedValue({
      id: empId, employee_code: 'NV-001', status: 'ACTIVE', user_id: null, departmentId: 5,
    })

    // Deactivate with active vector + active enrollment -> 409, data untouched
    mocks.queryRaw.mockResolvedValueOnce([{ id: 'job-enrolling-1' }])
    mocks.findFirst.mockResolvedValueOnce({ id: 'vec-active-1' })

    await expect(deactivate('NV-001', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.updateMany).not.toHaveBeenCalled()

    // DELETE with existing vector + active enrollment -> 409, data & audit untouched
    mocks.queryRaw.mockResolvedValueOnce([{ id: 'job-enrolling-1' }])
    mocks.findFirst.mockResolvedValueOnce({ id: 'vec-any-1' })

    await expect(removeAllWithPermissionCheck('NV-001', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.deleteMany).not.toHaveBeenCalled()
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })

  it('preserves ADMIN 404 for missing employee, MANAGER 403 out-of-scope, normal fast-path (no count/findFirst when idle), 404 on second deactivate, and single audit on concurrent DELETE', async () => {
    // ADMIN missing employee -> 404
    mocks.resolveManagedEmployee.mockRejectedValueOnce(new AppError(404, 'Employee not found'))
    await expect(deactivate('MISSING', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 404 })

    // MANAGER out-of-scope -> 403
    mocks.resolveManagedEmployee.mockRejectedValueOnce(AppError.forbidden('Employee management denied'))
    await expect(removeAllWithPermissionCheck('NV-OTHER', { id: 'mgr-1', role: 'MANAGER' }))
      .rejects.toMatchObject({ statusCode: 403 })

    // Normal case (no active enrollment): skips count() & findFirst(), uses updateMany/deleteMany count directly
    mocks.resolveManagedEmployee.mockResolvedValue({
      id: empId, employee_code: 'NV-001', status: 'ACTIVE', user_id: null, departmentId: 5,
    })
    mocks.updateMany
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 0 })

    await deactivate('NV-001', { id: 'adm-1', role: 'ADMIN' })
    expect(mocks.count).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()

    // Second deactivate -> 404
    await expect(deactivate('NV-001', { id: 'adm-1', role: 'ADMIN' }))
      .rejects.toMatchObject({ statusCode: 404, message: 'No active biometric data found for this employee' })

    // Two concurrent DELETE calls serialized by biometric:<empId> lock -> only the first writes auditLog
    mocks.deleteMany
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 0 })

    const [del1, del2] = await Promise.allSettled([
      removeAllWithPermissionCheck('NV-001', { id: 'adm-1', role: 'ADMIN' }),
      removeAllWithPermissionCheck('NV-001', { id: 'adm-1', role: 'ADMIN' }),
    ])
    expect(del1.status).toBe('fulfilled')
    expect(del2.status).toBe('rejected')
    expect((del2 as PromiseRejectedResult).reason).toMatchObject({ statusCode: 404 })
    expect(mocks.auditLogCreate).toHaveBeenCalledTimes(1)
  })

  it('recovers from committed face_enrollment_receipts without calling face_auth again when HTTP response was previously lost, and skips second receipt read on confirmed HTTP 200', async () => {
    const prevKey = env.FACE_AUTH_INTERNAL_KEY
    ;(env as any).FACE_AUTH_INTERNAL_KEY = 'a'.repeat(40)
    const origFetch = globalThis.fetch
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as any
    try {
      // Case A: Prior receipt already exists in DB -> completes job from receipt without calling face_auth
      mocks.currentActor.mockResolvedValueOnce({ id: 'adm-1', role: 'ADMIN' })
      mocks.queryRaw.mockResolvedValueOnce([{ result: { status: 'ok', n_samples_used: 3 } }])

      await executeEnrollment({
        id: 'job-recovered',
        owner_id: 'adm-1',
        lease_token: 'lease-1',
        type: 'biometric.enroll',
        payload: { employeeId: empId, employeeCode: 'NV-001' },
      } as any)

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(mocks.stagedInput).not.toHaveBeenCalled()
      expect(mocks.executeRaw).toHaveBeenCalledTimes(1)

      // Case B: Fresh execution with confirmed HTTP 200 JSON containing operation_id -> 1 receipt query before HTTP, 0 after HTTP
      mocks.queryRaw.mockClear()
      mocks.executeRaw.mockClear()
      mocks.currentActor.mockResolvedValueOnce({ id: 'adm-1', role: 'ADMIN' })
      mocks.queryRaw.mockResolvedValueOnce([])
      mocks.stagedInput.mockResolvedValueOnce({ images: ['img1', 'img2', 'img3'] })
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', operation_id: 'job-99', n_samples_used: 3 }), { status: 200 }),
      )

      const res = await executeEnrollment({
        id: 'job-99',
        owner_id: 'adm-1',
        lease_token: 'lease-1',
        type: 'biometric.enroll',
        payload: { employeeId: empId, employeeCode: 'NV-001' },
      } as any)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(mocks.queryRaw).toHaveBeenCalledTimes(1)
      expect(res).toEqual({ dataChange: { domain: 'biometrics', employeeIds: [empId] } })
    } finally {
      ;(env as any).FACE_AUTH_INTERNAL_KEY = prevKey
      globalThis.fetch = origFetch
    }
  })
})
