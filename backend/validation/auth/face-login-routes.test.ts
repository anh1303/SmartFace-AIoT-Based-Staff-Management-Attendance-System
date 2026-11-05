import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { faceLoginRouter } from '../../src/modules/auth/face-login/face-login.routes.js'
import { recognizeLogin } from '../../src/modules/auth/face-login/face-login.service.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { requirePasswordAuth } from '../../src/modules/auth/face-login/require-password.js'

vi.mock('../../src/modules/auth/face-login/face-login.service.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/modules/auth/face-login/face-login.service.js')>(),
  faceLoginConfigured: () => true, recognizeLogin: vi.fn(),
}))

describe('Browser camera login routing', () => {
  const app = express().use(cookieParser()).use(express.json()).use('/face', faceLoginRouter).use(errorHandler)
  const origin = env.CORS_ORIGIN.split(',')[0].trim()
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(recognizeLogin).mockResolvedValue({
    user: { id: 'employee-user', role: 'EMPLOYEE' }, accessToken: 'signed-token',
  } as any) })

  it('consumes the browser-bound challenge once and sets only an authentication cookie', async () => {
    const browser = request.agent(app)
    const challenge = await browser.post('/face/challenges').set('Origin', origin).expect(200)
    const payload = { challengeId: challenge.body.data.challengeId, frames: Array(8).fill('YWJj') }
    const result = await browser.post('/face').set('Origin', origin).send(payload).expect(200)
    expect(result.body.data.user.id).toBe('employee-user')
    expect(result.headers['set-cookie'].some((value: string) => value.startsWith('token=') && value.includes('HttpOnly'))).toBe(true)
    expect(recognizeLogin).toHaveBeenCalledOnce()
    await browser.post('/face').set('Origin', origin).send(payload).expect(401)
    expect(recognizeLogin).toHaveBeenCalledOnce()
  })
  it('rejects other origins and a challenge copied to another browser', async () => {
    await request(app).post('/face/challenges').set('Origin', 'https://attacker.invalid').expect(403)
    const challenge = await request(app).post('/face/challenges').set('Origin', origin).expect(200)
    await request(app).post('/face').set('Origin', origin).send({
      challengeId: challenge.body.data.challengeId, frames: Array(8).fill('YWJj'),
    }).expect(401)
    expect(recognizeLogin).not.toHaveBeenCalled()
  })
  it('returns a machine-readable password challenge and rejects oversized JSON without leaking the body', async () => {
    const sensitive = express().use(express.json({ limit: '1kb' }))
    sensitive.post('/sensitive', (req, _res, next) => { req.user = { id: 'a', username: 'a', role: 'EMPLOYEE', amr: ['face'] }; next() }, requirePasswordAuth)
    sensitive.use(errorHandler)
    const denied = await request(sensitive).post('/sensitive').send({}).expect(403)
    expect(denied.body.code).toBe('PASSWORD_REQUIRED')
    const oversized = await request(sensitive).post('/sensitive').send({ private_image: 'x'.repeat(2000) }).expect(413)
    expect(JSON.stringify(oversized.body)).not.toContain('private_image')
  })
})
