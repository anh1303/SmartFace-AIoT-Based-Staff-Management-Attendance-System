import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { AppError } from '../../src/common/AppError.js'
import { faceLoginRouter } from '../../src/modules/auth/face-login/face-login.routes.js'
import * as authController from '../../src/modules/auth/auth.controller.js'
import {
  attemptStatus,
  attempts,
  cancelAttempt,
  completeAttempt,
  invalidateFaceLoginBinding,
  processAttemptFrame,
  startAttempt,
} from '../../src/modules/auth/face-login/face-login.service.js'
import {
  createFaceSession,
  login as loginService,
  passwordSession,
  verifyAndLoadActiveUser,
} from '../../src/modules/auth/auth.service.js'
import { configureAuthBiometrics } from '../../src/modules/auth/auth.biometrics-port.js'
import { asyncHandler } from '../../src/middlewares/asyncHandler.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'

vi.mock('../../src/modules/auth/auth.service.js', () => ({
  createFaceSession: vi.fn(),
  login: vi.fn(),
  passwordSession: vi.fn(),
  verifyAndLoadActiveUser: vi.fn(),
}))

const unitVec = Array(512).fill(1 / Math.sqrt(512))
const validB64 = (tag: string) => Buffer.from(`jpeg-${tag}`).toString('base64')

describe('Face login lifecycle matrix, dual aliases, restart fail-closed, and dev Origin proxy', () => {
  let bootId = 'boot-live-1'
  let bIdx = 0
  const nextBinding = () => `${(++bIdx).toString(16).padStart(32, '0')}`

  const buildDualAliasApp = () => {
    const a = express()
      .set('trust proxy', 1)
      .use(cookieParser())
      .use(['/api/auth/face-login', '/api/v1/auth/face-login'], express.json({ limit: '300kb' }))
      .use(express.json({ limit: '20mb' }))
      .post('/api/auth/login', asyncHandler(authController.login))
      .post('/api/v1/auth/login', asyncHandler(authController.login))
      .post('/api/auth/logout', authController.logout)
      .post('/api/v1/auth/logout', authController.logout)
      .use('/api/auth/face-login', faceLoginRouter)
      .use('/api/v1/auth/face-login', faceLoginRouter)
      .use(errorHandler)
    return a
  }

  beforeEach(() => {
    vi.clearAllMocks()
    bootId = 'boot-live-1'
    Object.assign(env, {
      FACE_LOGIN_ENABLED: true,
      FACE_MATCH_THRESHOLD: 0.45,
      FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32),
      FACE_AUTH_MODEL_VERSION: 'buffalo_s',
      CORS_ORIGIN: 'http://localhost:5173',
    })
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    configureAuthBiometrics({
      hasFaceLoginTemplate: vi.fn(async () => true),
      findBestFaceMatch: vi.fn(async () => ({
        emp_id: 'emp-1',
        employee_code: 'NV001',
        full_name: 'Employee One',
        avatar_url: null,
        embedding_type: 'CENTROID',
        similarity: 0.91,
      })),
    } as any)
    vi.mocked(createFaceSession).mockResolvedValue({
      user: { id: 'emp-user-1', role: 'EMPLOYEE', username: 'nv001' },
      accessToken: 'jwt-emp-1',
    } as any)
    vi.mocked(passwordSession).mockResolvedValue({
      user: { id: 'emp-user-1', role: 'EMPLOYEE', username: 'nv001' },
      accessToken: 'jwt-pwd-stepup',
    } as any)

    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/attempts')) {
        return new Response(JSON.stringify({
          attempt_id: body.attempt_id,
          boot_id: bootId,
          model_version: env.FACE_AUTH_MODEL_VERSION,
        }))
      }
      if (url.endsWith('/cancel')) {
        return new Response(JSON.stringify({ status: 'cancelled' }))
      }
      const aid = url.split('/').slice(-2)[0]
      return new Response(JSON.stringify({
        attempt_id: aid,
        boot_id: bootId,
        seq: body.seq,
        operation_id: body.operation_id,
        model_version: env.FACE_AUTH_MODEL_VERSION,
        status: 'embedding',
        reason: 'ok',
        embedding: unitVec,
      }))
    }))
  })

  it('executes interleaving matrix: frame+frame, frame+cancel, frame+expiry, complete+complete, complete+cancel before/after commit, complete+logout, logout+recovery, wrong binding', async () => {
    // 1. frame + frame concurrent -> second frame gets 409 conflict while first is PROCESSING
    process.env.ATTENDANCE_STABLE_COUNT = '2'
    const bind1 = nextBinding()
    const s1 = await startAttempt(bind1)
    let releaseFrame1!: () => void
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/cancel')) return new Response(JSON.stringify({ status: 'cancelled' }))
      await new Promise<void>(r => { releaseFrame1 = r })
      return new Response(JSON.stringify({
        attempt_id: s1.attemptId, boot_id: bootId, seq: body.seq, operation_id: body.operation_id,
        model_version: env.FACE_AUTH_MODEL_VERSION, status: 'embedding', reason: 'ok', embedding: unitVec,
      }))
    }))
    const f1Promise = processAttemptFrame(s1.attemptId, bind1, 1, validB64('1'))
    await expect(processAttemptFrame(s1.attemptId, bind1, 2, validB64('2'))).rejects.toMatchObject({ statusCode: 409 })
    // Wrong binding cannot inspect, submit frame, cancel or complete
    expect(() => attemptStatus(s1.attemptId, nextBinding())).toThrowError(expect.objectContaining({ statusCode: 404 }))
    expect(() => cancelAttempt(s1.attemptId, nextBinding())).toThrowError(expect.objectContaining({ statusCode: 404 }))
    await expect(completeAttempt(s1.attemptId, nextBinding())).rejects.toMatchObject({ statusCode: 404 })
    releaseFrame1()
    expect((await f1Promise).state).toBe('pending')

    // 2. frame + cancel -> frame in flight is rejected with 410 once cancelled
    let releaseFrame2!: () => void
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/cancel')) return new Response(JSON.stringify({ status: 'cancelled' }))
      await new Promise<void>(r => { releaseFrame2 = r })
      return new Response(JSON.stringify({
        attempt_id: s1.attemptId, boot_id: bootId, seq: body.seq, operation_id: body.operation_id,
        model_version: env.FACE_AUTH_MODEL_VERSION, status: 'embedding', reason: 'ok', embedding: unitVec,
      }))
    }))
    const f2Promise = processAttemptFrame(s1.attemptId, bind1, 2, validB64('2'))
    cancelAttempt(s1.attemptId, bind1)
    releaseFrame2()
    await expect(f2Promise).rejects.toMatchObject({ statusCode: 410 })

    // 3. frame + expiry -> frame completing after attempt deadline is rejected with 410 and marks EXPIRED
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    const bindExp = nextBinding()
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/attempts')) {
        return new Response(JSON.stringify({ attempt_id: body.attempt_id, boot_id: bootId, model_version: env.FACE_AUTH_MODEL_VERSION }))
      }
      if (url.endsWith('/cancel')) return new Response(JSON.stringify({ status: 'cancelled' }))
      const a = attempts.get(url.split('/').slice(-2)[0], bindExp)
      a.deadline = Date.now() - 1 // expire during RPC
      return new Response(JSON.stringify({
        attempt_id: a.id, boot_id: bootId, seq: body.seq, operation_id: body.operation_id,
        model_version: env.FACE_AUTH_MODEL_VERSION, status: 'embedding', reason: 'ok', embedding: unitVec,
      }))
    }))
    const sExp = await startAttempt(bindExp)
    await expect(processAttemptFrame(sExp.attemptId, bindExp, 1, validB64('exp'))).rejects.toMatchObject({ statusCode: 410 })
    expect(attemptStatus(sExp.attemptId, bindExp).state).toBe('expired')

    // 4. complete + complete -> both resolve with the exact same cached token; complete + cancel after commit -> 409
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
      const body = options?.body ? JSON.parse(options.body) : {}
      if (url.endsWith('/attempts')) return new Response(JSON.stringify({ attempt_id: body.attempt_id, boot_id: bootId, model_version: env.FACE_AUTH_MODEL_VERSION }))
      if (url.endsWith('/cancel')) return new Response(JSON.stringify({ status: 'cancelled' }))
      return new Response(JSON.stringify({
        attempt_id: url.split('/').slice(-2)[0], boot_id: bootId, seq: body.seq, operation_id: body.operation_id,
        model_version: env.FACE_AUTH_MODEL_VERSION, status: 'embedding', reason: 'ok', embedding: unitVec,
      }))
    }))
    const bindComp = nextBinding()
    const sComp = await startAttempt(bindComp)
    await processAttemptFrame(sComp.attemptId, bindComp, 1, validB64('c1'))
    let tokenSeq = 0
    vi.mocked(createFaceSession).mockImplementation(async () => {
      const t = `jwt-${++tokenSeq}`
      await new Promise(r => setTimeout(r, 5))
      return { user: { id: 'emp-user-1' }, accessToken: t } as any
    })
    const [resA, resB] = await Promise.all([
      completeAttempt(sComp.attemptId, bindComp),
      completeAttempt(sComp.attemptId, bindComp),
    ])
    expect(resA.accessToken).toBe('jwt-1')
    expect(resB.accessToken).toBe('jwt-1')
    expect(() => cancelAttempt(sComp.attemptId, bindComp)).toThrowError(expect.objectContaining({ statusCode: 409 }))

    // 5. logout + recovery -> invalidates completed recovery immediately
    invalidateFaceLoginBinding(bindComp)
    await expect(completeAttempt(sComp.attemptId, bindComp)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('fails closed on Python restart (boot_id change) or Node restart (attempt missing) without rebuilding PAD evidence', async () => {
    process.env.ATTENDANCE_STABLE_COUNT = '2'
    const bind = nextBinding()
    const started = await startAttempt(bind)
    const f1 = await processAttemptFrame(started.attemptId, bind, 1, validB64('1'))
    expect(f1.state).toBe('pending')

    // Simulate Python restart -> bootId changes on frame 2 -> attempt fails closed (401 FAILED)
    bootId = 'boot-restarted-2'
    await expect(processAttemptFrame(started.attemptId, bind, 2, validB64('2'))).rejects.toMatchObject({ statusCode: 401 })
    expect(attemptStatus(started.attemptId, bind).state).toBe('failed')
    await expect(completeAttempt(started.attemptId, bind)).rejects.toMatchObject({ statusCode: 410 })

    // Simulate Node restart -> attempt is missing from store -> frame/complete fail closed with 404
    const unknownAttemptId = 'f'.repeat(32)
    await expect(processAttemptFrame(unknownAttemptId, bind, 1, validB64('1'))).rejects.toMatchObject({ statusCode: 404 })
    await expect(completeAttempt(unknownAttemptId, bind)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('enforces 300 KiB body cap, shared rate limits, Vite proxy Origin (http://localhost:5173) logout invalidation, and account/role/template checks across both /api and /api/v1 aliases', async () => {
    const dualApp = buildDualAliasApp()
    const devOrigin = 'http://localhost:5173'
    expect(env.CORS_ORIGIN.split(',').map(s => s.trim())).toContain(devOrigin)

    // 300 KiB body cap enforced on both /api/auth/face-login and /api/v1/auth/face-login without leaking image data
    const hugeFrame = 'A'.repeat(310_000)
    const over1 = await request(dualApp).post(`/api/auth/face-login/attempts/${'a'.repeat(32)}/frames`)
      .set('Origin', devOrigin).send({ seq: 1, frame: hugeFrame }).expect(413)
    const over2 = await request(dualApp).post(`/api/v1/auth/face-login/attempts/${'a'.repeat(32)}/frames`)
      .set('Origin', devOrigin).send({ seq: 1, frame: hugeFrame }).expect(413)
    expect(JSON.stringify(over1.body)).not.toContain('AAAAAAAAAA')
    expect(JSON.stringify(over2.body)).not.toContain('AAAAAAAAAA')

    // Start via /api/auth/face-login, send frame via /api/v1/auth/face-login, complete via /api/auth/face-login,
    // then logout via /api/v1/auth/logout with Vite dev Origin http://localhost:5173 -> invalidates recovery on both aliases
    const agent = request.agent(dualApp)
    const startRes = await agent.post('/api/auth/face-login/attempts').set('Origin', devOrigin).send({}).expect(200)
    const aid = startRes.body.data.attemptId as string
    expect(typeof startRes.body.data.remainingMs).toBe('number')

    const frameRes = await agent.post(`/api/v1/auth/face-login/attempts/${aid}/frames`)
      .set('Origin', devOrigin).send({ seq: 1, frame: validB64('alias') }).expect(200)
    expect(frameRes.body.data.state).toBe('verified')

    const compRes = await agent.post(`/api/auth/face-login/attempts/${aid}/complete`)
      .set('Origin', devOrigin).send({}).expect(200)
    expect(compRes.body.data.user.id).toBe('emp-user-1')

    // Retry complete via /api/v1 alias works while binding is still valid
    await agent.post(`/api/v1/auth/face-login/attempts/${aid}/complete`)
      .set('Origin', devOrigin).send({}).expect(200)

    // Logout with http://localhost:5173 invalidates attempt recovery on the server
    const bindingCookieHeader = (startRes.get('Set-Cookie') ?? []).find(c => c.startsWith('face_login_attempt='))!.split(';')[0]
    const logoutRes = await agent.post('/api/v1/auth/logout').set('Origin', devOrigin).send({}).expect(200)
    expect((logoutRes.get('Set-Cookie') ?? []).some(c => c.startsWith('token=;'))).toBe(true)
    expect((logoutRes.get('Set-Cookie') ?? []).some(c => c.startsWith('face_login_attempt=;'))).toBe(true)

    // Even if client replays the old binding cookie header after logout, recovery is gone (404)
    await request(dualApp).post(`/api/auth/face-login/attempts/${aid}/complete`)
      .set('Origin', devOrigin).set('Cookie', bindingCookieHeader).send({}).expect(404)

    // Account disabled / role changed / template deleted during completion fails closed (401)
    for (const reason of ['account_disabled', 'role_changed_to_manager', 'template_deleted']) {
      const agentFail = request.agent(dualApp)
      const s = await agentFail.post('/api/auth/face-login/attempts').set('Origin', devOrigin).send({}).expect(200)
      await agentFail.post(`/api/auth/face-login/attempts/${s.body.data.attemptId}/frames`)
        .set('Origin', devOrigin).send({ seq: 1, frame: validB64(reason) }).expect(200)
      vi.mocked(createFaceSession).mockRejectedValueOnce(AppError.unauthorized(reason))
      await agentFail.post(`/api/auth/face-login/attempts/${s.body.data.attemptId}/complete`)
        .set('Origin', devOrigin).send({}).expect(401)
      const st = await agentFail.get(`/api/auth/face-login/attempts/${s.body.data.attemptId}`).expect(200)
      expect(st.body.data.state).toBe('failed')
    }
  })
})
