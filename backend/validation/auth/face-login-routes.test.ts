import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { faceLoginRouter } from '../../src/modules/auth/face-login/face-login.routes.js'
import * as authController from '../../src/modules/auth/auth.controller.js'
import { engineCreate, engineFrame } from '../../src/modules/auth/face-login/face-login.engine.js'
import { createFaceSession, login as loginService, passwordSession } from '../../src/modules/auth/auth.service.js'
import { configureAuthBiometrics } from '../../src/modules/auth/auth.biometrics-port.js'
import { asyncHandler } from '../../src/middlewares/asyncHandler.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { requirePasswordAuth } from '../../src/modules/auth/face-login/require-password.js'

vi.mock('../../src/modules/auth/face-login/face-login.engine.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/modules/auth/face-login/face-login.engine.js')>(),
  engineCreate: vi.fn(async () => 'boot-1'), engineFrame: vi.fn(), engineCancel: vi.fn(),
}))
vi.mock('../../src/modules/auth/auth.service.js', () => ({
  createFaceSession: vi.fn(),
  login: vi.fn(),
  passwordSession: vi.fn(),
}))

describe('Browser camera streaming login routing', () => {
  const app = express()
    .set('trust proxy', 1)
    .use(cookieParser())
    .use(express.json({ limit: '300kb' }))
    .post('/auth/login', asyncHandler(authController.login))
    .post('/auth/logout', authController.logout)
    .use('/face', faceLoginRouter)
    .use(errorHandler)
  const origin = env.CORS_ORIGIN.split(',')[0].trim()
  const vec = Array(512).fill(1 / Math.sqrt(512))

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(env, { FACE_LOGIN_ENABLED: true, FACE_MATCH_THRESHOLD: 0.45, FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32) })
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    configureAuthBiometrics({
      hasFaceLoginTemplate: vi.fn(),
      findBestFaceMatch: vi.fn(async () => ({
        emp_id: 'emp-1', employee_code: 'E1', full_name: 'Emp',
        avatar_url: null, embedding_type: 'CENTROID', similarity: 0.9,
      })),
    } as any)
    vi.mocked(createFaceSession).mockResolvedValue({
      user: { id: 'employee-user', role: 'EMPLOYEE' }, accessToken: 'stream-jwt',
    } as any)
  })

  const cookies = (res: request.Response): string[] => res.get('Set-Cookie') ?? []

  it('streams frames without issuing auth cookies until explicit completion and recovers lost responses', async () => {
    const browserA = request.agent(app)
    const browserB = request.agent(app)
    const start = await browserA.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const attemptId = start.body.data.attemptId as string
    const bindingHeader = cookies(start).find(v => v.startsWith('face_login_attempt='))!.split(';')[0]

    vi.mocked(engineFrame).mockResolvedValueOnce({
      attempt_id: attemptId, boot_id: 'boot-1', seq: 1, operation_id: 'op-1', model_version: env.FACE_AUTH_MODEL_VERSION,
      status: 'embedding', reason: 'ok', embedding: vec,
    })

    // Wrong browser cannot inspect, submit frames, cancel or complete browserA's attempt.
    await browserB.get(`/face/attempts/${attemptId}`).expect(404)
    await browserB.post(`/face/attempts/${attemptId}/cancel`).set('Origin', origin).send({}).expect(404)
    await browserB.post(`/face/attempts/${attemptId}/complete`).set('Origin', origin).send({}).expect(404)

    const frameRes = await browserA.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'YWJj' }).expect(200)
    expect(frameRes.body.data.state).toBe('verified')
    expect(cookies(frameRes)).toEqual([])

    const statusRes = await browserA.get(`/face/attempts/${attemptId}`).expect(200)
    expect(statusRes.body.data.state).toBe('verified')
    expect(cookies(statusRes)).toEqual([])

    const completeRes = await browserA.post(`/face/attempts/${attemptId}/complete`).set('Origin', origin).send({}).expect(200)
    expect(completeRes.body.data.user.id).toBe('employee-user')
    expect(cookies(completeRes).some(v => v.startsWith('token=stream-jwt') && v.includes('HttpOnly'))).toBe(true)
    // Complete MUST NOT clear or renew face_login_attempt cookie so the browser's real cookie jar can query status/retry
    expect(cookies(completeRes).some(v => v.startsWith('face_login_attempt='))).toBe(false)

    // Real cookie jar (browserA) queries status -> completed, and retries complete -> same cached token without re-injecting Cookie header
    const statusAfterComplete = await browserA.get(`/face/attempts/${attemptId}`).expect(200)
    expect(statusAfterComplete.body.data.state).toBe('completed')
    expect(typeof statusAfterComplete.body.data.remainingMs).toBe('number')

    const retryRes = await browserA.post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).send({}).expect(200)
    expect(retryRes.body.data.user.id).toBe('employee-user')
    expect(cookies(retryRes).some(v => v.startsWith('token=stream-jwt'))).toBe(true)
    expect(cookies(retryRes).some(v => v.startsWith('face_login_attempt='))).toBe(false)
    expect(createFaceSession).toHaveBeenCalledOnce()
    await browserA.post(`/face/attempts/${attemptId}/cancel`)
      .set('Origin', origin).send({}).expect(409)
  })

  it('rejects untrusted origins, oversized JSON bodies and extra fields on all mutating endpoints', async () => {
    await request(app).post('/face/attempts').set('Origin', 'https://attacker.invalid').send({}).expect(403)
    const browser = request.agent(app)
    const start = await browser.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const attemptId = start.body.data.attemptId as string

    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', 'https://attacker.invalid')
      .send({ seq: 1, frame: 'YWJj' }).expect(403)
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'YWJj', employee_id: 'injected' }).expect(422)
    // Non-canonical Base64 (e.g. 'YWJ=' decodes to 'ab' which re-encodes as 'YWI=') is rejected before RPC
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'YWJ=' }).expect(422)
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'A'.repeat(310_000) }).expect(413)
    expect(engineFrame).not.toHaveBeenCalled()
  })

  it('distinguishes 429 error codes (ENGINE_BUSY, FRAME_RATE_LIMIT, ATTEMPT_CAPACITY) and separates frame quota from control endpoints', async () => {
    const browser = request.agent(app)
    const start = await browser.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const attemptId = start.body.data.attemptId as string

    // Active attempt already exists for same browser -> 429 ATTEMPT_CAPACITY
    const dupStart = await browser.post('/face/attempts').set('Origin', origin).send({}).expect(429)
    expect(dupStart.body.code).toBe('ATTEMPT_CAPACITY')

    // Engine busy -> 429 ENGINE_BUSY without advancing sequence
    const { EngineError } = await import('../../src/modules/auth/face-login/face-login.engine.js')
    vi.mocked(engineFrame).mockRejectedValueOnce(new EngineError('busy'))
    const busyRes = await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'YWJj' }).expect(429)
    expect(busyRes.body.code).toBe('ENGINE_BUSY')

    // Exceed 5 frames/second per attempt -> 429 FRAME_RATE_LIMIT
    process.env.ATTENDANCE_STABLE_COUNT = '6'
    const browser2 = request.agent(app)
    const start2 = await browser2.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const aid2 = start2.body.data.attemptId as string
    for (let seq = 1; seq <= 5; seq++) {
      const f = Buffer.from(`img-${seq}`).toString('base64')
      vi.mocked(engineFrame).mockResolvedValueOnce({
        attempt_id: aid2, boot_id: 'boot-1', seq, operation_id: 'op', model_version: env.FACE_AUTH_MODEL_VERSION,
        status: 'pending', reason: 'pad_pending',
      })
      await browser2.post(`/face/attempts/${aid2}/frames`).set('Origin', origin)
        .send({ seq, frame: f }).expect(200)
    }
    const f6 = Buffer.from('img-6').toString('base64')
    const rateRes = await browser2.post(`/face/attempts/${aid2}/frames`).set('Origin', origin)
      .send({ seq: 6, frame: f6 }).expect(429)
    expect(rateRes.body.code).toBe('FRAME_RATE_LIMIT')

    // Control endpoints (status/cancel) remain available even after frame rate limit is hit
    await browser2.get(`/face/attempts/${aid2}`).expect(200)
    await browser2.post(`/face/attempts/${aid2}/cancel`).set('Origin', origin).send({}).expect(200)

    // Exhaust IP frame quota (300 requests/min/IP) from a dedicated shared office IP and confirm status/complete/cancel still work
    const sharedIp = '203.0.113.55'
    process.env.ATTENDANCE_STABLE_COUNT = '1'
    const browser3 = request.agent(app)
    const start3 = await browser3.post('/face/attempts').set('Origin', origin).set('X-Forwarded-For', sharedIp).send({}).expect(200)
    const aid3 = start3.body.data.attemptId as string
    vi.mocked(engineFrame).mockResolvedValueOnce({
      attempt_id: aid3, boot_id: 'boot-1', seq: 1, operation_id: 'op', model_version: env.FACE_AUTH_MODEL_VERSION,
      status: 'embedding', reason: 'ok', embedding: vec,
    })
    await browser3.post(`/face/attempts/${aid3}/frames`).set('Origin', origin).set('X-Forwarded-For', sharedIp)
      .send({ seq: 1, frame: 'YWJj' }).expect(200)

    // Exhaust remaining frameLimiter quota on the shared IP (sending invalid seq 99 so Zod rejects before service)
    let ipRateLimited: request.Response | null = null
    for (let i = 0; i < 305; i++) {
      const r = await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin).set('X-Forwarded-For', sharedIp)
        .send({ seq: 99, frame: 'YWJj' })
      if (r.status === 429 && r.body?.code === 'IP_RATE_LIMIT') {
        ipRateLimited = r
        break
      }
    }
    expect(ipRateLimited).not.toBeNull()
    expect(ipRateLimited?.body.code).toBe('IP_RATE_LIMIT')

    // Despite frame IP quota being exhausted on sharedIp, control endpoints (status, complete, cancel) still succeed on sharedIp
    const st3 = await browser3.get(`/face/attempts/${aid3}`).set('X-Forwarded-For', sharedIp).expect(200)
    expect(st3.body.data.state).toBe('verified')
    const comp3 = await browser3.post(`/face/attempts/${aid3}/complete`).set('Origin', origin).set('X-Forwarded-For', sharedIp).send({}).expect(200)
    expect(comp3.body.data.user.id).toBe('employee-user')
    await browser.post(`/face/attempts/${attemptId}/cancel`).set('Origin', origin).set('X-Forwarded-For', sharedIp).send({}).expect(200)
  })

  it('returns a machine-readable password challenge and rejects oversized JSON without leaking the body', async () => {
    const sensitive = express().use(express.json({ limit: '1kb' }))
    sensitive.post('/sensitive', (req, _res, next) => {
      req.user = { id: 'a', username: 'a', role: 'EMPLOYEE', amr: ['face'] }
      next()
    }, requirePasswordAuth)
    sensitive.use(errorHandler)
    const denied = await request(sensitive).post('/sensitive').send({}).expect(403)
    expect(denied.body.code).toBe('PASSWORD_REQUIRED')
    const oversized = await request(sensitive).post('/sensitive').send({ private_image: 'x'.repeat(2000) }).expect(413)
    expect(JSON.stringify(oversized.body)).not.toContain('private_image')
  })

  it('logout with allowed Origin invalidates completed recovery and active attempt, while missing/wrong Origin still clears cookies without mutating server store', async () => {
    const browser = request.agent(app)
    const start = await browser.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const attemptId = start.body.data.attemptId as string
    const bindingHeader = cookies(start).find(v => v.startsWith('face_login_attempt='))!.split(';')[0]

    vi.mocked(engineFrame).mockResolvedValueOnce({
      attempt_id: attemptId, boot_id: 'boot-1', seq: 1, operation_id: 'op-1', model_version: env.FACE_AUTH_MODEL_VERSION,
      status: 'embedding', reason: 'ok', embedding: vec,
    })
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin).send({ seq: 1, frame: 'YWJj' }).expect(200)
    await browser.post(`/face/attempts/${attemptId}/complete`).set('Origin', origin).send({}).expect(200)

    // Missing Origin on logout: clears cookies in response, but does NOT mutate server attempt store
    const noOriginLogout = await request(app).post('/auth/logout').set('Cookie', bindingHeader).send({}).expect(200)
    expect(cookies(noOriginLogout).some(v => v.startsWith('token=;'))).toBe(true)
    expect(cookies(noOriginLogout).some(v => v.startsWith('face_login_attempt=;'))).toBe(true)
    await request(app).post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(200)

    // Wrong Origin on logout: clears cookies in response, does NOT mutate server attempt store
    await request(app).post('/auth/logout').set('Origin', 'https://attacker.invalid').set('Cookie', bindingHeader).send({}).expect(200)
    await request(app).post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(200)

    // Allowed Origin on logout: clears cookies AND invalidates server attempt/recovery
    const validLogout = await request(app).post('/auth/logout').set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(200)
    expect(cookies(validLogout).some(v => v.startsWith('token=;'))).toBe(true)
    expect(cookies(validLogout).some(v => v.startsWith('face_login_attempt=;'))).toBe(true)
    await request(app).post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(404)
  })

  it('password login drops old completed face-login recovery for the same binding', async () => {
    const browser = request.agent(app)
    const start = await browser.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const attemptId = start.body.data.attemptId as string
    const bindingHeader = cookies(start).find(v => v.startsWith('face_login_attempt='))!.split(';')[0]

    vi.mocked(engineFrame).mockResolvedValueOnce({
      attempt_id: attemptId, boot_id: 'boot-1', seq: 1, operation_id: 'op-1', model_version: env.FACE_AUTH_MODEL_VERSION,
      status: 'embedding', reason: 'ok', embedding: vec,
    })
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin).send({ seq: 1, frame: 'YWJj' }).expect(200)
    await browser.post(`/face/attempts/${attemptId}/complete`).set('Origin', origin).send({}).expect(200)

    vi.mocked(loginService).mockResolvedValueOnce({
      user: { id: 'pwd-user', role: 'EMPLOYEE' }, accessToken: 'pwd-jwt',
    } as any)
    await request(app).post('/auth/login').set('Cookie', bindingHeader)
      .send({ identifier: 'emp1', password: 'Password123!' }).expect(200)

    // Stale face-login completion retry cannot overwrite the new password session
    await request(app).post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(404)
  })

  it('headers_delivered_body_lost_recovers_same_attempt and logout_clears_cookie_already_set_by_complete_headers in a real HTTP cookie jar', async () => {
    let headersFlushed!: () => void
    let headersReady = new Promise<void>(r => { headersFlushed = r })
    let mode: 'truncate' | 'hold' = 'truncate'

    const streamingApp = express()
      .use(cookieParser())
      .use(express.json({ limit: '300kb' }))
      .get('/test/cookies', (req, res) => res.json(req.cookies))
      .post('/auth/logout', authController.logout)
      .post('/face/attempts/:id/complete-streamed', async (req, res, next) => {
        try {
          const { completeAttempt } = await import('../../src/modules/auth/face-login/face-login.service.js')
          const result = await completeAttempt(req.params.id, req.cookies?.face_login_attempt)
          res.cookie('token', result.accessToken, authController.getCookieOptions(false))
          // Superagent buffers JSON even with buffer(false); use an unbuffered body
          // in the hold case so its real cookie jar can apply Set-Cookie at headers.
          res.status(200).set('Content-Type', mode === 'hold' ? 'application/octet-stream' : 'application/json')
          res.flushHeaders()
          if (mode === 'truncate') {
            res.write('{"success":true,"data":')
            res.socket?.destroy()
            return
          }
          headersFlushed()
          // Hold body until client aborts
          await new Promise<void>(resolve => req.on('close', () => resolve()))
        } catch (e) { next(e) }
      })
      .use('/face', faceLoginRouter)
      .use(errorHandler)

    // Case A: Complete delivers Set-Cookie headers but connection drops mid-body (truncated response).
    // Cookie jar still retains face_login_attempt, queries status -> completed, and retries complete -> same cached token.
    const agentRecover = request.agent(streamingApp)
    const start1 = await agentRecover.post('/face/attempts').set('Origin', origin).send({}).expect(200)
    const aid1 = start1.body.data.attemptId as string
    vi.mocked(engineFrame).mockResolvedValueOnce({
      attempt_id: aid1, boot_id: 'boot-1', seq: 1, operation_id: 'op-1', model_version: env.FACE_AUTH_MODEL_VERSION,
      status: 'embedding', reason: 'ok', embedding: vec,
    })
    await agentRecover.post(`/face/attempts/${aid1}/frames`).set('Origin', origin).send({ seq: 1, frame: 'YWJj' }).expect(200)

    mode = 'truncate'
    await expect(
      agentRecover.post(`/face/attempts/${aid1}/complete-streamed`).set('Origin', origin).send({}),
    ).rejects.toThrow()

    const status1 = await agentRecover.get(`/face/attempts/${aid1}`).expect(200)
    expect(status1.body.data.state).toBe('completed')
    const recovered1 = await agentRecover.post(`/face/attempts/${aid1}/complete`).set('Origin', origin).send({}).expect(200)
    expect(recovered1.body.data.user.id).toBe('employee-user')
    expect(createFaceSession).toHaveBeenCalledTimes(1)

    // Case B: Complete delivers Set-Cookie headers and holds body; client aborts complete and sends logout.
    mode = 'hold'
    headersReady = new Promise<void>(r => { headersFlushed = r })
    // Keep the server alive while the response body is open and the cookie echo uses another connection.
    const logoutServer = streamingApp.listen(0)
    await new Promise<void>(resolve => logoutServer.once('listening', resolve))
    const agentLogout = request.agent(logoutServer)
    try {
      const start2 = await agentLogout.post('/face/attempts').set('Origin', origin).send({}).expect(200)
      const aid2 = start2.body.data.attemptId as string
      vi.mocked(engineFrame).mockResolvedValueOnce({
        attempt_id: aid2, boot_id: 'boot-1', seq: 1, operation_id: 'op-1', model_version: env.FACE_AUTH_MODEL_VERSION,
        status: 'embedding', reason: 'ok', embedding: vec,
      })
      await agentLogout.post(`/face/attempts/${aid2}/frames`).set('Origin', origin).send({ seq: 1, frame: 'YWJj' }).expect(200)

      // Do not wait for a complete JSON body before the agent processes response headers/cookies.
      const reqComplete = agentLogout.post(`/face/attempts/${aid2}/complete-streamed`).set('Origin', origin).buffer(false).send({})
      const inFlight = new Promise<void>((resolve, reject) => {
        reqComplete.then(response => {
          // Closing a deliberately unfinished response emits ECONNRESET on its stream.
          response.on('error', (error: NodeJS.ErrnoException) => expect(error.code).toBe('ECONNRESET'))
          resolve()
        }, reject)
      })
      await headersReady
      await inFlight
      const beforeAbort = await agentLogout.get('/test/cookies').expect(200)
      expect(beforeAbort.body.token).toBe('stream-jwt')
      expect(beforeAbort.body.face_login_attempt).toBeTruthy()
      reqComplete.abort()

      // Subsequent logout clears both token and binding in the agent's cookie jar and invalidates recovery
      const logoutRes = await agentLogout.post('/auth/logout').set('Origin', origin).send({}).expect(200)
      expect(cookies(logoutRes).some(v => v.startsWith('token=;'))).toBe(true)
      expect(cookies(logoutRes).some(v => v.startsWith('face_login_attempt=;'))).toBe(true)
      const afterLogout = await agentLogout.get('/test/cookies').expect(200)
      expect(afterLogout.body).not.toHaveProperty('token')
      expect(afterLogout.body).not.toHaveProperty('face_login_attempt')
      await agentLogout.post(`/face/attempts/${aid2}/complete`).set('Origin', origin).send({}).expect(404)
    } finally {
      logoutServer.closeAllConnections()
      await new Promise<void>((resolve, reject) => logoutServer.close(error => error ? reject(error) : resolve()))
    }
  })
})
