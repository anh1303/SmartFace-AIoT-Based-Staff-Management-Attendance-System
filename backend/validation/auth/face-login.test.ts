import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChallengeStore, faceSessionAllowed } from '../../src/modules/auth/face-login/face-login.policy.js'
import { env } from '../../src/config/env.js'
import { recognizeLogin, loginBody } from '../../src/modules/auth/face-login/face-login.service.js'
import { prisma } from '../../src/config/database.js'
import { findBestFaceMatch } from '../../src/modules/biometrics/public.js'
import { createFaceSession } from '../../src/modules/auth/auth.service.js'

vi.mock('../../src/config/database.js', () => ({ prisma: { user: { findMany: vi.fn(), update: vi.fn() }, attendance_logs: { create: vi.fn() } } }))
vi.mock('../../src/modules/biometrics/public.js', () => ({ findBestFaceMatch: vi.fn() }))
vi.mock('../../src/modules/auth/auth.service.js', () => ({ createFaceSession: vi.fn() }))

describe('Face login policies', () => {
  it('consumes a challenge once, binds it to a browser and expires it', () => {
    let now = 0
    const store = new ChallengeStore(() => now, 100, 2)
    const challenge = store.create('browser-a')
    expect(store.consume(challenge.id, 'browser-b')).toBeNull()
    expect(store.consume(challenge.id, 'browser-a')).toBeNull()
    const second = store.create('browser-a')
    now = 101
    expect(store.consume(second.id, 'browser-a')).toBeNull()
    const third = store.create('browser-a')
    expect(store.consume(third.id, 'browser-a')?.id).toBe(third.id)
    expect(store.consume(third.id, 'browser-a')).toBeNull()
  })

  it('bounds pending challenges and removes expired entries', () => {
    let now = 0
    const store = new ChallengeStore(() => now, 100, 1)
    store.create('a')
    expect(() => store.create('b')).toThrow()
    now = 101
    expect(() => store.create('b')).not.toThrow()
  })

  it('allows employee face sessions without a profile toggle while retaining role and system checks', () => {
    expect(faceSessionAllowed(['face'], 'EMPLOYEE', true)).toBe(true)
    for (const role of ['ADMIN', 'MANAGER', 'UNKNOWN']) expect(faceSessionAllowed(['face'], role, true)).toBe(false)
    expect(faceSessionAllowed(['face'], 'EMPLOYEE', false)).toBe(false)
    expect(faceSessionAllowed(undefined, 'ADMIN', false)).toBe(true)
  })
})

describe('Face recognition creates only an authentication session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(env, { FACE_LOGIN_ENABLED: true, FACE_MATCH_THRESHOLD: 0.45, FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32) })
    process.env.ATTENDANCE_STABLE_COUNT = '3'
    vi.mocked(findBestFaceMatch).mockResolvedValue({ emp_id: 'employee-a', similarity: 0.5 } as any)
    vi.mocked(createFaceSession).mockResolvedValue({ user: { id: 'user-a' }, accessToken: 'signed-session' } as any)
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const input = JSON.parse(options.body)
      return new Response(JSON.stringify({ request_id: input.request_id, status: 'ok',
        model_version: env.FACE_AUTH_MODEL_VERSION, embeddings: Array(3).fill(Array(512).fill(1 / Math.sqrt(512))) }))
    }))
  })

  it('issues login without touching attendance or any user mutation', async () => {
    const result = await recognizeLogin(['jpeg'])
    expect(result.accessToken).toBe('signed-session')
    expect(createFaceSession).toHaveBeenCalledWith('employee-a')
    expect(findBestFaceMatch).toHaveBeenCalledTimes(3)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(prisma.attendance_logs.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects AI failures and untrusted client-supplied identity or attendance fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'rejected' }))))
    await expect(recognizeLogin(['jpeg'])).rejects.toMatchObject({ statusCode: 401 })
    expect(createFaceSession).not.toHaveBeenCalled()
    expect(loginBody.safeParse({ challengeId: 'a'.repeat(32), frames: Array(8).fill('aaaa'), employee_id: 'a', type: 'CHECK_IN' }).success).toBe(false)
  })
  it('rejects mismatched consecutive identities without issuing a session', async () => {
    vi.mocked(findBestFaceMatch).mockResolvedValueOnce({ emp_id: 'employee-a', similarity: 0.9 } as any)
      .mockResolvedValueOnce({ emp_id: 'employee-b', similarity: 0.9 } as any)
    await expect(recognizeLogin(['jpeg'])).rejects.toMatchObject({ statusCode: 401 })
    expect(createFaceSession).not.toHaveBeenCalled()
    expect(prisma.attendance_logs.create).not.toHaveBeenCalled()
  })
  it('supports six confirmations without treating a valid AI response as oversized', async () => {
    process.env.ATTENDANCE_STABLE_COUNT = '6'
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const input = JSON.parse(options.body)
      return new Response(JSON.stringify({ request_id: input.request_id, status: 'ok',
        model_version: env.FACE_AUTH_MODEL_VERSION,
        embeddings: Array(6).fill(Array(512).fill(0.04419417382415922)) }))
    }))
    await expect(recognizeLogin(['jpeg'])).resolves.toHaveProperty('accessToken', 'signed-session')
    expect(findBestFaceMatch).toHaveBeenCalledTimes(6)
  })
})
