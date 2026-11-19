import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops(db))),
  employee: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

import { env } from '../../src/config/env.js'
import '../../src/composition.js'
import * as biometricsPublic from '../../src/modules/biometrics/public.js'
import { employeeInclude } from '../../src/modules/employees/employee.model.js'
import { formatEmployee } from '../../src/modules/employees/employee.format.js'
import * as employeeService from '../../src/modules/employees/employee.service.js'

describe('Biometrics ownership of employee face_enrolled status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports faceEnrollmentSummarySelect and hasActiveFaceEnrollment from biometrics/public.ts', () => {
    const selectDescriptor = (biometricsPublic as any).faceEnrollmentSummarySelect
    const hasActive = (biometricsPublic as any).hasActiveFaceEnrollment

    expect(selectDescriptor).toBeDefined()
    expect(selectDescriptor).toEqual({
      where: {
        is_active: true,
        embedding_type: 'CENTROID',
        model_version: env.FACE_AUTH_MODEL_VERSION,
      },
      select: {
        id: true,
        model_version: true,
        sample_tag: true,
        quality_score: true,
        created_at: true,
      },
    })
    expect(typeof hasActive).toBe('function')
    expect(hasActive(null)).toBe(false)
    expect(hasActive(undefined)).toBe(false)
    expect(hasActive([])).toBe(false)
    expect(hasActive([{ id: 'sample-1', model_version: env.FACE_AUTH_MODEL_VERSION }])).toBe(true)
  })

  it('keeps hasFaceLoginTemplate distinct from summary enrollment projection', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ enrolled: false }])
    const canLogin = await biometricsPublic.hasFaceLoginTemplate('00000000-0000-0000-0000-000000000001')
    expect(canLogin).toBe(false)
    const [sql] = db.$queryRaw.mock.calls[0]
    expect(sql.join('?')).toContain('embedding IS NOT NULL')
  })

  it('uses biometrics descriptor in employee.model.ts and biometrics predicate in employee.format.ts', () => {
    expect(employeeInclude.face_embeddings).toBe((biometricsPublic as any).faceEnrollmentSummarySelect)

    const formatSource = readFileSync(resolve('src/modules/employees/employee.format.ts'), 'utf8')
    expect(formatSource).toContain('hasActiveFaceEnrollment')
    expect(formatSource).not.toMatch(/Array\.isArray\(emp\.face_embeddings\)/)

    expect(
      formatEmployee({
        id: 'emp-none',
        full_name: 'No Face Sample',
        face_embeddings: [],
      }).face_enrolled
    ).toBe(false)

    expect(
      formatEmployee({
        id: 'emp-active',
        full_name: 'Active Face Sample',
        face_embeddings: [{ id: 'emb-1', model_version: env.FACE_AUTH_MODEL_VERSION }],
      }).face_enrolled
    ).toBe(true)
  })

  it('evaluates a page of employees (no sample, active sample, inactive-only filtered to empty) without N+1 queries', async () => {
    db.employee.findMany.mockResolvedValueOnce([
      { id: 'emp-1', employee_code: 'NV01', full_name: 'No Sample', face_embeddings: [] },
      { id: 'emp-2', employee_code: 'NV02', full_name: 'Active Sample', face_embeddings: [{ id: 'e2' }] },
      { id: 'emp-3', employee_code: 'NV03', full_name: 'Inactive Sample Only', face_embeddings: [] },
    ])
    db.employee.count.mockResolvedValueOnce(3)

    const page = await employeeService.list({ page: 1, limit: 20 }, { id: 'admin', role: 'ADMIN' })
    expect(page.items.map((item: any) => ({ id: item.id, face_enrolled: item.face_enrolled }))).toEqual([
      { id: 'emp-1', face_enrolled: false },
      { id: 'emp-2', face_enrolled: true },
      { id: 'emp-3', face_enrolled: false },
    ])
    expect(db.employee.findMany).toHaveBeenCalledTimes(1)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})
