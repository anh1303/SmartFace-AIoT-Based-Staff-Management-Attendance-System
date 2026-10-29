import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/config/database.js', () => ({ prisma: { device: {
  create: () => { throw new Error('Unexpected database write before authorization') },
  findUnique: () => { throw new Error('Unexpected database read before authorization') },
} } }))
import { positionRouter } from '../src/modules/employees/position.routes.js'
import { shiftRouter } from '../src/modules/shifts/shift.routes.js'
import * as devices from '../src/modules/devices/device.service.js'

describe('global resources require Admin', () => {
  it.each([
    [positionRouter, '/', 'post'], [positionRouter, '/:id', 'put'], [shiftRouter, '/templates', 'post'],
  ])('rejects manager catalog mutations before entering controllers', (router, path, method) => {
    const route = (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method as string]).route
    let error: any
    route.stack[0].handle({ user: { id: 'manager', role: 'MANAGER' } }, {}, (value: any) => { error = value })
    expect(error?.statusCode).toBe(403)
  })
  it('rejects manager shared-device writes and control in the service as well', async () => {
    for (const action of [
      () => devices.create({ name: 'shared', location: 'gate' }, 'manager', 'MANAGER'),
      () => devices.update('shared', { name: 'changed' }, 'manager', 'MANAGER'),
      () => devices.setDeviceAttendanceMode('shared', 'CHECK_OUT', 'MANAGER'),
    ]) await expect(action()).rejects.toMatchObject({ statusCode: 403 })
  })
})
