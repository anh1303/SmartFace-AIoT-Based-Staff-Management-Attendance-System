import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findBestFaceMatch } from '../../src/modules/biometrics/biometric.service.js'
import { prisma } from '../../src/config/database.js'
import { env } from '../../src/config/env.js'

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../../src/modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: vi.fn(),
  findActiveEmployeeIds: vi.fn(),
}))

import { findEmployeeByIdOrCode, findActiveEmployeeIds } from '../../src/modules/employees/public.js'

describe('Biometric model version, CENTROID representation, and active employee pre-filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters strictly by FACE_AUTH_MODEL_VERSION and CENTROID, ignoring legacy or non-centroid vectors', async () => {
    const activeModel = env.FACE_AUTH_MODEL_VERSION || 'buffalo_s'
    vi.mocked(findActiveEmployeeIds).mockResolvedValue(['emp-uuid-current'])

    // Mock queryRaw to capture SQL query string & parameters
    let capturedQueryText = ''
    let capturedValues: any[] = []

    vi.mocked(prisma.$queryRaw).mockImplementation(async (strings: any, ...values: any[]) => {
      capturedQueryText = Array.isArray(strings) ? strings.join('?') : String(strings)
      capturedValues = values

      // Simulate DB where older model or non-centroid row would NOT match the WHERE clause
      // and only the matching current model version + CENTROID row is returned
      return [
        {
          employee_id: 'emp-uuid-current',
          embedding_type: 'CENTROID',
          similarity: 0.88,
        },
      ]
    })

    vi.mocked(findEmployeeByIdOrCode).mockResolvedValue({
      id: 'emp-uuid-current',
      employee_code: 'EMP001',
      full_name: 'Nguyen Van A',
      avatar_url: 'https://example.com/avatar.jpg',
      status: 'ACTIVE',
    } as any)

    const vec = '[' + Array(512).fill('0.04419417').join(',') + ']'
    const match = await findBestFaceMatch(vec)

    // 1. Verify SQL enforces model_version, CENTROID embedding_type, and active employee IDs
    expect(capturedQueryText).toContain('f.model_version = ?')
    expect(capturedQueryText).toContain("f.embedding_type = 'CENTROID'")
    expect(capturedQueryText).toContain('f.employee_id = ANY(?::uuid[])')
    expect(capturedValues).toContain(activeModel)
    expect(capturedValues).toContainEqual(['emp-uuid-current'])

    // 2. Verify returned match matches the active employee
    expect(match).not.toBeNull()
    expect(match?.emp_id).toBe('emp-uuid-current')
    expect(match?.employee_code).toBe('EMP001')
    expect(match?.similarity).toBe(0.88)
    expect(match?.embedding_type).toBe('CENTROID')
  })

  it('selects active employee (0.90) over higher-similarity inactive employee (0.95)', async () => {
    const activeModel = env.FACE_AUTH_MODEL_VERSION || 'buffalo_s'

    // Mock active employee contract: only active employee ID is returned
    vi.mocked(findActiveEmployeeIds).mockResolvedValue(['emp-uuid-active'])

    let capturedQueryText = ''
    let capturedValues: any[] = []

    vi.mocked(prisma.$queryRaw).mockImplementation(async (strings: any, ...values: any[]) => {
      capturedQueryText = Array.isArray(strings) ? strings.join('?') : String(strings)
      capturedValues = values

      // Pre-filtering in SQL `f.employee_id = ANY(${activeEmployeeIds}::uuid[])`
      // excluded the inactive candidate (0.95), so Postgres returns the active candidate (0.90)
      return [
        {
          employee_id: 'emp-uuid-active',
          embedding_type: 'CENTROID',
          similarity: 0.90,
        },
      ]
    })

    vi.mocked(findEmployeeByIdOrCode).mockResolvedValue({
      id: 'emp-uuid-active',
      employee_code: 'EMP-ACTIVE',
      full_name: 'Nguyen Van Active',
      avatar_url: null,
      status: 'ACTIVE',
    } as any)

    const vec = '[' + Array(512).fill('0.04419417').join(',') + ']'
    const match = await findBestFaceMatch(vec)

    expect(capturedQueryText).toContain('f.employee_id = ANY(?::uuid[])')
    expect(capturedValues).toContainEqual(['emp-uuid-active'])
    expect(match).not.toBeNull()
    expect(match?.emp_id).toBe('emp-uuid-active')
    expect(match?.similarity).toBe(0.90)
  })

  it('returns null if no active employees exist', async () => {
    vi.mocked(findActiveEmployeeIds).mockResolvedValue([])

    const vec = '[' + Array(512).fill('0.04419417').join(',') + ']'
    const match = await findBestFaceMatch(vec)

    expect(match).toBeNull()
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns null if matching employee is inactive or terminated', async () => {
    vi.mocked(findActiveEmployeeIds).mockResolvedValue(['emp-uuid-terminated'])

    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        employee_id: 'emp-uuid-terminated',
        embedding_type: 'CENTROID',
        similarity: 0.95,
      },
    ])

    vi.mocked(findEmployeeByIdOrCode).mockResolvedValue({
      id: 'emp-uuid-terminated',
      employee_code: 'EMP999',
      full_name: 'Old Employee',
      status: 'TERMINATED',
    } as any)

    const vec = '[' + Array(512).fill('0.04419417').join(',') + ']'
    const match = await findBestFaceMatch(vec)

    expect(match).toBeNull()
  })
})
