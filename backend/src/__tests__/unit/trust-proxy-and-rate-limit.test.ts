import express from 'express'
import request from 'supertest'
import { rateLimit } from 'express-rate-limit'
import { describe, expect, it } from 'vitest'
import { configureTrustProxy } from '../../app.js'
import { validateEnvInput } from '../../config/env.js'

function createRateLimitedApp(hops: number, limit = 2) {
  const testApp = express()
  configureTrustProxy(testApp, hops)
  const limiter = rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
  testApp.get('/ping', limiter, (req, res) => {
    res.json({ ip: req.ip, proto: req.protocol })
  })
  return testApp
}

describe('trust proxy, rate-limit client IP isolation, and production env validation', () => {
  it('isolates rate-limit quotas per client IP behind 1 proxy hop without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR', async () => {
    const testApp = createRateLimitedApp(1, 2)
    expect(testApp.get('trust proxy')).toBe(1)

    // Client A hits its 2-request quota
    const a1 = await request(testApp).get('/ping').set('X-Forwarded-For', '203.0.113.10').set('X-Forwarded-Proto', 'https')
    const a2 = await request(testApp).get('/ping').set('X-Forwarded-For', '203.0.113.10')
    const a3 = await request(testApp).get('/ping').set('X-Forwarded-For', '203.0.113.10')
    expect(a1.status).toBe(200)
    expect(a1.body).toEqual({ ip: '203.0.113.10', proto: 'https' })
    expect(a2.status).toBe(200)
    expect(a3.status).toBe(429)

    // Client B is NOT locked out by Client A
    const b1 = await request(testApp).get('/ping').set('X-Forwarded-For', '203.0.113.20')
    expect(b1.status).toBe(200)
    expect(b1.body.ip).toBe('203.0.113.20')
  })

  it('prevents bypassing rate limit via spoofed leftmost X-Forwarded-For headers on 1-hop and 2-hop topologies', async () => {
    const twoHopApp = createRateLimitedApp(2, 2)
    expect(twoHopApp.get('trust proxy')).toBe(2)

    // Fixed topology: Caddy -> Nginx -> Node
    // Rightmost 2 entries are [realClientIp, caddy/nginx hop]; leftmost spoofed IP must be ignored.
    const r1 = await request(twoHopApp).get('/ping').set('X-Forwarded-For', '1.1.1.1, 198.51.100.7, 172.18.0.5')
    const r2 = await request(twoHopApp).get('/ping').set('X-Forwarded-For', '8.8.8.8, 198.51.100.7, 172.18.0.5')
    const r3 = await request(twoHopApp).get('/ping').set('X-Forwarded-For', '9.9.9.9, 198.51.100.7, 172.18.0.5')

    expect(r1.status).toBe(200)
    expect(r1.body.ip).toBe('198.51.100.7')
    expect(r2.status).toBe(200)
    expect(r2.body.ip).toBe('198.51.100.7')
    expect(r3.status).toBe(429)
  })

  it('validates TRUST_PROXY_HOPS and enforces TB_WEBHOOK_SECRET in production when TB_HOST is configured', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'a'.repeat(32),
      MQTT_DEVICE_SECRET: 'b'.repeat(32),
      BIOMETRIC_ENCRYPTION_KEY: 'c'.repeat(32),
    }

    const okDev = validateEnvInput({ ...baseEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: '2' })
    expect(okDev.success).toBe(true)
    if (okDev.success) {
      expect(okDev.data.TRUST_PROXY_HOPS).toBe(2)
      expect(okDev.data.OPERATION_RECOVERY_INTERVAL_MS).toBe(900_000)
      expect(okDev.data.ATTENDANCE_ALERTS_INTERVAL_MS).toBe(900_000)
    }

    const badProdWebhook = validateEnvInput({
      ...baseEnv,
      NODE_ENV: 'production',
      TB_HOST: 'thingsboard',
      TB_WEBHOOK_SECRET: 'too-short',
    })
    expect(badProdWebhook.success).toBe(false)

    const okProdWebhook = validateEnvInput({
      ...baseEnv,
      NODE_ENV: 'production',
      TB_HOST: 'thingsboard',
      TB_WEBHOOK_SECRET: 's'.repeat(24),
    })
    expect(okProdWebhook.success).toBe(true)
  })
})
