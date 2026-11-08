import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const service = vi.hoisted(() => ({ fingerprintManifest: vi.fn(), fingerprintTemplateForDevice: vi.fn() }))
vi.mock('../../src/modules/biometrics/fingerprint.service.js', () => service)
import { fingerprintDeviceRouter } from '../../src/modules/biometrics/fingerprint.routes.js'

const app = express()
app.use(express.json())
app.use('/devices/:id/fingerprint', fingerprintDeviceRouter)
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 400).json({ error: 'request rejected' }))
const token = 'test-device-key-with-at-least-32-characters'
const health = { capacity: 300, ready: true, roundtrip_verified: true, wak_verified: true, error: null }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EDGE_RECOGNITION_KEYS', JSON.stringify({ PI_A: token }))
  service.fingerprintManifest.mockResolvedValue({ bindings: [], session: null })
  service.fingerprintTemplateForDevice.mockResolvedValue({ template_b64: 'only-for-device' })
})
afterEach(() => vi.unstubAllEnvs())

it('keeps legacy clients on v1 and separates the v2 protocol field from device health', async () => {
  for (const version of [1, 2] as const) {
    const body = version === 1 ? health : { ...health, manifest_version: 2 }
    const res = await request(app).post('/devices/PI_A/fingerprint/manifest').auth(token, { type: 'bearer' }).send(body)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(service.fingerprintManifest).toHaveBeenLastCalledWith('PI_A', health, version)
  }
})

it('requires the assigned device credential and valid revision/checksum for template downloads', async () => {
  const path = '/devices/PI_A/fingerprint/bindings/12345678-1234-4234-8234-123456789abc/template'
  const body = { revision: 2, checksum: 'a'.repeat(64) }
  expect((await request(app).post(path).send(body)).status).toBe(401)
  expect((await request(app).post(path).auth('wrong', { type: 'bearer' }).send(body)).status).toBe(401)
  expect(service.fingerprintTemplateForDevice).not.toHaveBeenCalled()
  expect((await request(app).post(path).auth(token, { type: 'bearer' }).send({ ...body, revision: 0 })).status).toBe(400)
  const result = await request(app).post(path).auth(token, { type: 'bearer' }).send(body)
  expect(result.status).toBe(200)
  expect(result.headers['cache-control']).toBe('no-store')
  expect(service.fingerprintTemplateForDevice).toHaveBeenCalledWith('PI_A', '12345678-1234-4234-8234-123456789abc', 2, body.checksum)
})
