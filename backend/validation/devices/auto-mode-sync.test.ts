import { afterEach, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
vi.mock('../../src/config/database.js', () => ({ prisma: {} }))
import { modeNotify } from '../../src/modules/devices/device.controller.js'
import { getDeviceMode } from '../../src/modules/devices/device.service.js'

afterEach(() => vi.unstubAllEnvs())

it('preserves AUTO mode notified by the single attendance device', async () => {
  const secret = 'auto-mode-test-secret-at-least-32-characters'
  vi.stubEnv('TB_WEBHOOK_SECRET', secret)
  const req = { params: { id: 'TEST_PI_AUTO' }, body: { mode: 'AUTO' }, header: () => secret } as unknown as Request
  const res: any = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  await modeNotify(req, res as Response)
  expect(res.status).toHaveBeenCalledWith(200)
  expect(await getDeviceMode('TEST_PI_AUTO')).toMatchObject({ mode: 'AUTO', confirmed: true })
})
