import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const request = vi.fn()
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('TB_HOST', 'http://test-thingsboard.local')
  vi.stubGlobal('fetch', request)
  request.mockReset()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

function mockRpc(reply: unknown, fail = false) {
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/auth/login')) return new Response(JSON.stringify({ token: 'test-token' }))
    if (url.includes('/api/tenant/devices')) return new Response(JSON.stringify({ id: { id: 'test-tb-device' }, name: 'PI_TEST' }))
    if (fail) throw new Error('RPC timeout')
    return new Response(JSON.stringify(reply))
  })
}

it.each([
  ['bluetooth-connect', { success: true, connected: false }],
  ['bluetooth-reconnect', { connected: false }],
  ['bluetooth-disconnect', { success: true, connected: true }],
  ['test-audio', { success: false, message: 'No Bluetooth output' }],
] as const)('does not turn a rejected %s into simulated success', async (action, reply) => {
  mockRpc(reply)
  const service = await import('../../src/modules/devices/device.service.js')
  await expect(service.triggerDeviceAction('PI_TEST', action)).rejects.toMatchObject({ statusCode: 502 })
})

it('does not fall back to a fake connected device after an RPC timeout', async () => {
  mockRpc(null, true)
  const service = await import('../../src/modules/devices/device.service.js')
  await expect(service.triggerDeviceAction('PI_TEST', 'bluetooth-connect')).rejects.toMatchObject({ statusCode: 502 })
})

it('returns the actual connected acknowledgement from Pi', async () => {
  const reply = { success: true, connected: true, deviceName: 'HAVIT TW958 PRO' }
  mockRpc(reply)
  const service = await import('../../src/modules/devices/device.service.js')
  expect(await service.triggerDeviceAction('PI_TEST', 'bluetooth-connect')).toMatchObject({ success: true, data: reply })
})
