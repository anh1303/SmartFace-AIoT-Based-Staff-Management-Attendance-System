import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({ listener: undefined as any, checkIn: vi.fn(), subscribe: vi.fn() }))
vi.mock('../../src/config/mqtt.js', () => ({ getMqttClient: () => ({ removeAllListeners: vi.fn(), subscribe: state.subscribe, on: (_: string, fn: any) => { state.listener = fn } }) }))
vi.mock('../../src/modules/attendance/attendance.service.js', () => ({ checkIn: state.checkIn }))

import { registerDeviceMqttHandlers } from '../../src/modules/devices/device.mqtt.handler.js'

describe('legacy MQTT', () => {
  it('does not record attendance from the legacy check-in topic', async () => {
    registerDeviceMqttHandlers()
    await state.listener('attendance/devices/device1/check-in', Buffer.from(JSON.stringify({ employeeId: 'employee1' })))
    expect(state.checkIn).not.toHaveBeenCalled()
  })
})
