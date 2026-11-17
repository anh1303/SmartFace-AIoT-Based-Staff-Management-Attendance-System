import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { faceLoginRouter } from '../../src/modules/auth/face-login/face-login.routes.js'
import { engineCreate, engineFrame } from '../../src/modules/auth/face-login/face-login.engine.js'
import { createFaceSession } from '../../src/modules/auth/auth.service.js'
import { configureAuthBiometrics } from '../../src/modules/auth/auth.biometrics-port.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { requirePasswordAuth } from '../../src/modules/auth/face-login/require-password.js'

vi.mock('../../src/modules/auth/face-login/face-login.engine.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/modules/auth/face-login/face-login.engine.js')>(),
  engineCreate: vi.fn(async () => 'boot-1'), engineFrame: vi.fn(), engineCancel: vi.fn(),
}))
vi.mock('../../src/modules/auth/auth.service.js', () => ({ createFaceSession: vi.fn() }))

describe('Browser camera streaming login routing', () => {
  const app = express()
    .use(cookieParser())
    .use('/face', express.json({ limit: '300kb' }), faceLoginRouter)
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
      attempt_id: attemptId, boot_id: 'boot-1', seq: 1, model_version: env.FACE_AUTH_MODEL_VERSION,
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
    expect(cookies(completeRes).some(v => v.startsWith('face_login_attempt=;'))).toBe(true)

    // Lost completion response / racing cancel with the bound cookie: retry reuses token, cancel returns 409.
    const retryRes = await request(app).post(`/face/attempts/${attemptId}/complete`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(200)
    expect(cookies(retryRes).some(v => v.startsWith('token=stream-jwt'))).toBe(true)
    expect(createFaceSession).toHaveBeenCalledOnce()
    await request(app).post(`/face/attempts/${attemptId}/cancel`)
      .set('Origin', origin).set('Cookie', bindingHeader).send({}).expect(409)
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
    await browser.post(`/face/attempts/${attemptId}/frames`).set('Origin', origin)
      .send({ seq: 1, frame: 'A'.repeat(310_000) }).expect(413)
    expect(engineFrame).not.toHaveBeenCalled()
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
})
