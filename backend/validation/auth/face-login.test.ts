import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/config/database.js'
import { findBestFaceMatch } from '../../src/modules/biometrics/public.js'
import { createFaceSession } from '../../src/modules/auth/auth.service.js'
import { configureAuthBiometrics } from '../../src/modules/auth/auth.biometrics-port.js'
import { faceSessionAllowed } from '../../src/modules/auth/face-login/face-login.policy.js'
import {
  AttemptError,
  AttemptStore,
  COMPLETION_RECOVERY_MS,
  VERIFIED_FRESH_MS,
} from '../../src/modules/auth/face-login/face-login.attempts.js'
import { frameBody } from '../../src/modules/auth/face-login/face-login.routes.js'
import {
  attemptStatus,
  attempts,
  cancelAttempt,
  completeAttempt,
  faceLoginConfigured,
  invalidateFaceLoginBinding,
  processAttemptFrame,
  startAttempt,
} from '../../src/modules/auth/face-login/face-login.service.js'

vi.mock('../../src/config/database.js', () => ({
  prisma: { user: { findMany: vi.fn(), update: vi.fn() }, attendance_logs: { create: vi.fn() } },
}))
vi.mock('../../src/modules/biometrics/public.js', () => ({ findBestFaceMatch: vi.fn() }))
vi.mock('../../src/modules/auth/auth.service.js', () => ({ createFaceSession: vi.fn() }))

const unitVec = Array(512).fill(1 / Math.sqrt(512))

describe('Face login policies and attempt store', () => {
  it('allows employee face sessions and validates recognition count range 1..6', () => {
    expect(faceSessionAllowed(['face'], 'EMPLOYEE', true)).toBe(true)
    for (const role of ['ADMIN', 'MANAGER', 'UNKNOWN']) expect(faceSessionAllowed(['face'], role, true)).toBe(false)
    expect(faceSessionAllowed(['face'], 'EMPLOYEE', false)).toBe(false)
    expect(faceSessionAllowed(undefined, 'ADMIN', false)).toBe(true)

    Object.assign(env, { FACE_LOGIN_ENABLED: true, FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32) })
    delete process.env.ATTENDANCE_STABLE_COUNT
    expect(faceLoginConfigured()).toBe(true)
    process.env.ATTENDANCE_STABLE_COUNT = '   '
    expect(faceLoginConfigured()).toBe(true)
    process.env.ATTENDANCE_STABLE_COUNT = ' 4 '
    expect(faceLoginConfigured()).toBe(true)
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    expect(faceLoginConfigured()).toBe(true)
    process.env.ATTENDANCE_STABLE_COUNT = '6'
    expect(faceLoginConfigured()).toBe(true)
    for (const invalid of ['0', '7', '-1', '2.5', '3abc', 'NaN', 'Infinity', '+3', '1e1']) {
      process.env.ATTENDANCE_STABLE_COUNT = invalid
      expect(faceLoginConfigured()).toBe(false)
    }
    process.env.ATTENDANCE_STABLE_COUNT = '3'
  })

  it('tracks consecutive identities, restarts on mismatch (A,A,B -> 1), clears on reset and stops at VERIFIED', () => {
    let now = 0
    const store = new AttemptStore(() => now)
    const a = store.create('browser-a', 3)
    const step = (seq: number, employeeId: string | null, pending = false) => {
      now += 250
      const r = store.startFrame(a, seq, `d${seq}`) as { op: string }
      return store.finishFrame(a, r.op, seq, `d${seq}`, { employeeId, pending }, 'ok')
    }
    expect(step(1, null, true).state).toBe('pending')
    expect(step(2, 'A').state).toBe('pending')
    expect(step(3, 'A').state).toBe('pending')
    expect(step(4, 'B').state).toBe('pending')
    expect(a.count).toBe(1)
    expect(step(5, null, false).state).toBe('pending')
    expect(a.count).toBe(0)
    expect(step(6, 'B').state).toBe('pending')
    expect(step(7, 'B').state).toBe('pending')
    expect(step(8, 'B').state).toBe('verified')
    expect(() => store.startFrame(a, 9, 'd9')).toThrow(AttemptError)
  })

  it('replays identical seq+digest without extra votes, rejects digest/seq conflicts and enforces 5 frames/s', () => {
    let now = 1000
    const store = new AttemptStore(() => now, 20, 5)
    const a = store.create('browser-a', 6)
    const r1 = store.startFrame(a, 1, 'digest-1') as { op: string }
    expect(() => store.startFrame(a, 2, 'digest-2')).toThrow() // concurrent frame while PROCESSING
    const res1 = store.finishFrame(a, r1.op, 1, 'digest-1', { employeeId: 'A' }, 'ok')
    expect(store.startFrame(a, 1, 'digest-1')).toEqual({ cached: res1 })
    expect(a.count).toBe(1)
    expect(() => store.startFrame(a, 1, 'wrong-digest')).toThrow()
    expect(() => store.startFrame(a, 3, 'digest-3')).toThrow()

    // 4 more frames within the same 1000ms window succeed (total 5); the 6th is rate-limited (429).
    for (let seq = 2; seq <= 5; seq++) {
      now += 100
      const r = store.startFrame(a, seq, `d${seq}`) as { op: string }
      store.finishFrame(a, r.op, seq, `d${seq}`, { employeeId: 'A' }, 'ok')
    }
    now += 100
    expect(() => store.startFrame(a, 6, 'd6')).toThrowError(expect.objectContaining({ status: 429 }))
    now += 600 // oldest frame exits the 1s sliding window
    const r6 = store.startFrame(a, 6, 'd6') as { op: string }
    expect(store.finishFrame(a, r6.op, 6, 'd6', { employeeId: 'A' }, 'ok').state).toBe('verified')
  })

  it('enforces 1 active attempt per browser, isolates browsers and bounds recovery TTL', () => {
    let now = 0
    const store = new AttemptStore(() => now, 2)
    const a = store.create('browser-a', 1)
    expect(() => store.create('browser-a', 1)).toThrowError(expect.objectContaining({ status: 429 }))
    expect(() => store.get(a.id, 'browser-b')).toThrowError(expect.objectContaining({ status: 404 }))
    expect(a.state).toBe('READY') // wrong browser did not destroy attempt

    const r = store.startFrame(a, 1, 'd1') as { op: string }
    store.finishFrame(a, r.op, 1, 'd1', { employeeId: 'A' }, 'ok')
    store.reserveCompletion(a)
    expect(() => store.cancel(a)).toThrowError(expect.objectContaining({ status: 409 }))
    store.finishCompletion(a, { user: { id: 'u' }, accessToken: 'tok-1' })
    expect(store.recover(a)?.accessToken).toBe('tok-1')
    expect(store.commit(a, { user: { id: 'u' }, accessToken: 'tok-2' }).accessToken).toBe('tok-1')

    now += COMPLETION_RECOVERY_MS + 1
    expect(store.recover(a)).toBeNull()
    expect(() => store.assertCompletable(a)).toThrowError(expect.objectContaining({ status: 410 }))

    // Verification freshness (5s) expires if completion waits too long.
    const b = store.create('browser-a', 1)
    const rb = store.startFrame(b, 1, 'd1') as { op: string }
    store.finishFrame(b, rb.op, 1, 'd1', { employeeId: 'A' }, 'ok')
    now += VERIFIED_FRESH_MS + 1
    expect(() => store.assertCompletable(b)).toThrowError(expect.objectContaining({ status: 410 }))
    expect(b.state).toBe('EXPIRED')
  })

  it('checks terminal and deadline states before replay cache lookup and supports invalidateBinding / dropCompletedRecovery', () => {
    let now = 1000
    const store = new AttemptStore(() => now, 20, 5)
    const a = store.create('browser-a', 2)
    const r1 = store.startFrame(a, 1, 'd1') as { op: string }
    const res1 = store.finishFrame(a, r1.op, 1, 'd1', { employeeId: 'A' }, 'ok')
    expect(store.startFrame(a, 1, 'd1')).toEqual({ cached: res1 })

    // Terminal state CANCELLED/EXPIRED/FAILED/COMPLETED must NOT return last cached frame replay
    store.cancel(a)
    expect(() => store.startFrame(a, 1, 'd1')).toThrowError(expect.objectContaining({ status: 410 }))

    const b = store.create('browser-a', 1)
    const rb = store.startFrame(b, 1, 'd1') as { op: string }
    const resB = store.finishFrame(b, rb.op, 1, 'd1', { employeeId: 'A' }, 'ok')
    // VERIFIED allows exact replay of the last frame before deadline
    expect(store.startFrame(b, 1, 'd1')).toEqual({ cached: resB })
    // Once COMPLETED, replay is rejected
    store.commit(b, { user: { id: 'u' }, accessToken: 'tok-b' })
    expect(() => store.startFrame(b, 1, 'd1')).toThrowError(expect.objectContaining({ status: 409 }))

    // dropCompletedRecovery removes only COMPLETED recovery entries for the binding without touching active attempts
    const c = store.create('browser-c', 1)
    store.dropCompletedRecovery('browser-c')
    expect(store.get(c.id, 'browser-c').state).toBe('READY')
    store.dropCompletedRecovery('browser-a')
    expect(() => store.get(b.id, 'browser-a')).toThrowError(expect.objectContaining({ status: 404 }))

    // invalidateBinding marks active attempts CANCELLED, clears evidence/operation, and deletes from map
    const d = store.create('browser-a', 2)
    const rd = store.startFrame(d, 1, 'd1') as { op: string }
    const cancelledIds = store.invalidateBinding('browser-a')
    expect(cancelledIds).toEqual([d.id])
    expect(d.state).toBe('CANCELLED')
    expect(d.operation).toBeNull()
    expect(d.candidate).toBeNull()
    expect(() => store.finishFrame(d, rd.op, 1, 'd1', { employeeId: 'A' }, 'ok')).toThrowError(expect.objectContaining({ status: 410 }))
    expect(() => store.get(d.id, 'browser-a')).toThrowError(expect.objectContaining({ status: 404 }))
  })
})

describe('Streaming service and Python RPC boundary', () => {
  let bCount = 0
  const nextBinding = () => `binding-${++bCount}-${Date.now()}`

  beforeEach(() => {
    configureAuthBiometrics({ findBestFaceMatch } as any)
    vi.clearAllMocks()
    Object.assign(env, { FACE_LOGIN_ENABLED: true, FACE_MATCH_THRESHOLD: 0.45, FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32) })
    process.env.ATTENDANCE_STABLE_COUNT = '3'
    vi.mocked(findBestFaceMatch).mockResolvedValue({ emp_id: 'employee-a', similarity: 0.85 } as any)
    vi.mocked(createFaceSession).mockResolvedValue({ user: { id: 'user-a' }, accessToken: 'signed-session' } as any)
    attempts.sweep()
  })

  function stubEngine(handler?: (url: string, body: any) => Response | Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/attempts')) {
        return new Response(JSON.stringify({
          attempt_id: body.attempt_id, boot_id: 'boot-1', model_version: env.FACE_AUTH_MODEL_VERSION,
        }))
      }
      if (url.endsWith('/cancel')) return new Response(JSON.stringify({ status: 'cancelled' }))
      if (handler) return handler(url, body)
      const pendingCount = process.env.ATTENDANCE_STABLE_COUNT === '1' ? 0 : 2
      return new Response(JSON.stringify({
        attempt_id: url.split('/').slice(-2)[0], boot_id: 'boot-1', seq: body.seq,
        operation_id: body.operation_id, model_version: env.FACE_AUTH_MODEL_VERSION,
        status: body.seq <= pendingCount ? 'pending' : 'embedding', reason: 'ok',
        ...(body.seq <= pendingCount ? {} : { embedding: unitVec }),
      }))
    }))
  }

  it('verifies after 2 pending PAD frames + 3 matching embeddings and issues session only at completeAttempt', async () => {
    stubEngine()
    const binding = nextBinding()
    const { attemptId } = await startAttempt(binding)
    for (let seq = 1; seq <= 4; seq++) {
      const f = Buffer.from(`img-${seq}`).toString('base64')
      const res = await processAttemptFrame(attemptId, binding, seq, f)
      expect(res.state).toBe('pending')
    }
    expect(createFaceSession).not.toHaveBeenCalled()
    const fifth = await processAttemptFrame(attemptId, binding, 5, Buffer.from('img-5').toString('base64'))
    expect(fifth.state).toBe('verified')
    expect(createFaceSession).not.toHaveBeenCalled()

    const session = await completeAttempt(attemptId, binding)
    expect(session.accessToken).toBe('signed-session')
    expect(createFaceSession).toHaveBeenCalledOnce()
    expect(findBestFaceMatch).toHaveBeenCalledTimes(3)
    expect(prisma.attendance_logs.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()

    // Lost-response retry returns identical token without minting a second session.
    const retry = await completeAttempt(attemptId, binding)
    expect(retry.accessToken).toBe('signed-session')
    expect(createFaceSession).toHaveBeenCalledOnce()
  })

  it('prevents token issuance if cancelled during awaited account check, and marks FAILED if account check rejects', async () => {
    stubEngine()
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    const binding1 = nextBinding()
    const { attemptId } = await startAttempt(binding1)
    await processAttemptFrame(attemptId, binding1, 1, 'YWJj1')
    let release!: (value: any) => void
    vi.mocked(createFaceSession).mockImplementationOnce(() => new Promise(r => { release = r }) as any)
    const pendingComplete = completeAttempt(attemptId, binding1)
    cancelAttempt(attemptId, binding1)
    release({ user: { id: 'u' }, accessToken: 'late-token' })
    await expect(pendingComplete).rejects.toMatchObject({ statusCode: 410 })

    // Ineligible account / removed template / disallowed role at completion marks attempt FAILED.
    const binding2 = nextBinding()
    const second = await startAttempt(binding2)
    await processAttemptFrame(second.attemptId, binding2, 1, 'YWJj1')
    vi.mocked(createFaceSession).mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: 401 }))
    await expect(completeAttempt(second.attemptId, binding2)).rejects.toMatchObject({ statusCode: 401 })
    expect(attemptStatus(second.attemptId, binding2).state).toBe('failed')
  })

  it('invalidate_during_account_lookup_prevents_commit and startAttempt drops old completed recovery', async () => {
    stubEngine()
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    const binding = nextBinding()
    const { attemptId } = await startAttempt(binding)
    await processAttemptFrame(attemptId, binding, 1, 'YWJj1')
    let release!: (value: any) => void
    vi.mocked(createFaceSession).mockImplementationOnce(() => new Promise(r => { release = r }) as any)
    const pendingComplete = completeAttempt(attemptId, binding)
    invalidateFaceLoginBinding(binding)
    release({ user: { id: 'u' }, accessToken: 'late-token' })
    await expect(pendingComplete).rejects.toMatchObject({ statusCode: 410 })
    expect(() => attemptStatus(attemptId, binding)).toThrowError(expect.objectContaining({ statusCode: 404 }))

    // Completed recovery is dropped when a new attempt starts on the same binding
    const binding2 = nextBinding()
    const first = await startAttempt(binding2)
    await processAttemptFrame(first.attemptId, binding2, 1, 'YWJj1')
    const committed = await completeAttempt(first.attemptId, binding2)
    expect(committed.accessToken).toBe('signed-session')

    const second = await startAttempt(binding2)
    expect(second.attemptId).not.toBe(first.attemptId)
    await expect(completeAttempt(first.attemptId, binding2)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('fails closed on Python restart (boot_id change), wrong model, unnormalized vector, timeout or spoof', async () => {
    const cases: Array<(id: string, body: any) => Response> = [
      (id, b) => new Response(JSON.stringify({ attempt_id: id, boot_id: 'restarted-boot', seq: b.seq, operation_id: b.operation_id, model_version: env.FACE_AUTH_MODEL_VERSION, status: 'pending', reason: 'ok' })),
      (id, b) => new Response(JSON.stringify({ attempt_id: id, boot_id: 'boot-1', seq: b.seq, operation_id: b.operation_id, model_version: 'wrong-model', status: 'pending', reason: 'ok' })),
      (id, b) => new Response(JSON.stringify({ attempt_id: id, boot_id: 'boot-1', seq: b.seq, operation_id: b.operation_id, model_version: env.FACE_AUTH_MODEL_VERSION, status: 'embedding', reason: 'ok', embedding: Array(512).fill(0) })),
      (id, b) => new Response(JSON.stringify({ attempt_id: id, boot_id: 'boot-1', seq: b.seq, operation_id: b.operation_id, model_version: env.FACE_AUTH_MODEL_VERSION, status: 'error', reason: 'pad_invalid' })),
    ]
    for (const responder of cases) {
      stubEngine((url, body) => responder(url.split('/').slice(-2)[0], body))
      const binding = nextBinding()
      const { attemptId } = await startAttempt(binding)
      await expect(processAttemptFrame(attemptId, binding, 1, 'YWJj')).rejects.toMatchObject({ statusCode: 401 })
      expect(attemptStatus(attemptId, binding).state).toBe('failed')
      expect(createFaceSession).not.toHaveBeenCalled()
    }
    expect(frameBody.safeParse({ seq: 1, frame: 'YWJj', employee_id: 'x' }).success).toBe(false)
  })

  it('returns remainingMs clamped >= 0 on startAttempt and attemptStatus, and concurrent completeAttempt returns consistent cached token', async () => {
    stubEngine()
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    const binding = nextBinding()
    const started = await startAttempt(binding)
    expect(typeof (started as any).remainingMs).toBe('number')
    expect((started as any).remainingMs).toBeGreaterThan(0)
    expect((started as any).remainingMs).toBeLessThanOrEqual(15_000)

    await processAttemptFrame(started.attemptId, binding, 1, 'YWJj1')
    const st = attemptStatus(started.attemptId, binding)
    expect(typeof (st as any).remainingMs).toBe('number')
    expect((st as any).remainingMs).toBeGreaterThanOrEqual(0)

    let callNum = 0
    vi.mocked(createFaceSession).mockImplementation(async () => {
      const n = ++callNum
      await new Promise(r => setTimeout(r, 5))
      return { user: { id: 'user-a' }, accessToken: `token-${n}` } as any
    })
    const [c1, c2] = await Promise.all([
      completeAttempt(started.attemptId, binding),
      completeAttempt(started.attemptId, binding),
    ])
    expect(c1.accessToken).toBe(c2.accessToken)
    expect(c1.accessToken).toBe('token-1')
  })
})
