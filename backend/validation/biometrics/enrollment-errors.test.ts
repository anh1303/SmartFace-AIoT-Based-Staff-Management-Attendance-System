import { afterEach, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn() }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/config/env.js', () => ({ env: { FACE_AUTH_URL: 'http://face-auth.test', FACE_AUTH_INTERNAL_KEY: 'test-key', FACE_AUTH_TIMEOUT_MS: 1000 } }))
vi.mock('../../src/modules/employees/public.js', () => ({ assertCanManageEmployee: vi.fn(), findEmployeeByIdOrCode: vi.fn() }))
vi.mock('../../src/modules/operations/public.js', () => ({
  currentActor: async () => ({ id: 'admin', role: 'ADMIN' }), stagedInput: async () => ({ images: ['test-image'] }),
  enqueueOperation: vi.fn(), assertNoEnrollment: vi.fn(), announceDataChange: vi.fn(),
}))
import { executeEnrollment } from '../../src/modules/biometrics/biometric.jobs.js'
const job = { id: 'job', owner_id: 'admin', payload: { employeeId: 'employee', employeeCode: 'NV-018' } } as any
afterEach(() => vi.unstubAllGlobals())

it('preserves the actual image rejection instead of blaming every failure on saving', async () => {
  const detail = 'Không phát hiện được khuôn mặt hợp lệ: 3 ảnh có nhiều khuôn mặt.'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail }), { status: 400 })))
  await expect(executeEnrollment(job)).rejects.toThrow(detail)
})

it.each([
  [401, 'khóa kết nối'], [403, 'khóa kết nối'], [422, 'định dạng'], [503, 'chưa sẵn sàng'], [500, 'HTTP 500'],
])('identifies upstream HTTP %s without exposing internal errors', async (status, expected) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'private SQL / credential details' }), { status: Number(status) })))
  try { await executeEnrollment(job); throw new Error('Expected failure') } catch (error) {
    expect((error as Error).message).toContain(expected)
    expect((error as Error).message).not.toContain('private SQL')
  }
})
