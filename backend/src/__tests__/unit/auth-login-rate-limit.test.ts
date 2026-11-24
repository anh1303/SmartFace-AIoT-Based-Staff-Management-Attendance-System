import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app, configureTrustProxy } from '../../app.js'
import * as authService from '../../modules/auth/auth.service.js'
import { AppError } from '../../common/AppError.js'

vi.mock('../../modules/auth/auth.service.js', () => ({
  login: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  passwordSession: vi.fn(),
}))

describe('POST /api/auth/login rate limiting behind reverse proxy', () => {
  const originalTrustProxy = app.get('trust proxy')

  beforeEach(() => {
    vi.clearAllMocks()
    configureTrustProxy(app, 2)
    vi.mocked(authService.login).mockRejectedValue(
      new AppError(401, 'Tên đăng nhập hoặc mật khẩu không đúng'),
    )
  })

  afterEach(() => {
    app.set('trust proxy', originalTrustProxy)
  })

  it('blocks excessive password login attempts with 429 before invoking authService, ignores spoofed leftmost XFF, and isolates other client IPs', async () => {
    const attackerRealIp = '198.51.100.42'
    const proxyHopIp = '172.18.0.5'
    const limit = 20

    // Exhaust the per-IP quota while rotating spoofed leftmost X-Forwarded-For values
    for (let i = 0; i < limit; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.0.0.${i + 1}, ${attackerRealIp}, ${proxyHopIp}`)
        .set('X-Forwarded-Proto', 'https')
        .send({ identifier: 'admin', password: `WrongPass#${i}` })

      expect(res.status).toBe(401)
    }

    expect(authService.login).toHaveBeenCalledTimes(limit)

    // Next attempt from the same real client IP (even with a new spoofed leftmost IP) must return 429
    // and must NOT hit authService.login (protecting bcrypt and Neon DB).
    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', `203.0.113.250, ${attackerRealIp}, ${proxyHopIp}`)
      .set('X-Forwarded-Proto', 'https')
      .send({ identifier: 'admin', password: 'WrongPass#final' })

    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({
      success: false,
      code: 'IP_RATE_LIMIT',
    })
    expect(authService.login).toHaveBeenCalledTimes(limit)

    // A different real client IP behind the same 2-hop proxy must NOT be locked out
    const otherClient = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', `198.51.100.99, ${proxyHopIp}`)
      .set('X-Forwarded-Proto', 'https')
      .send({ identifier: 'admin', password: 'WrongPass#other' })

    expect(otherClient.status).toBe(401)
    expect(authService.login).toHaveBeenCalledTimes(limit + 1)
  })
})
