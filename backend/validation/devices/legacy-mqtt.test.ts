import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({
  listener: undefined as any,
  checkIn: vi.fn(),
  subscribe: vi.fn(),
  updateStatus: vi.fn(),
  publish: vi.fn(),
}))

vi.mock('../../src/config/mqtt.js', () => ({
  getMqttClient: () => ({
    removeAllListeners: vi.fn(),
    subscribe: state.subscribe,
    on: (_: string, fn: any) => { state.listener = fn },
  }),
}))
vi.mock('../../src/modules/attendance/attendance.service.js', () => ({ checkIn: state.checkIn }))
vi.mock('../../src/modules/devices/device.service.js', () => ({
  updateStatus: state.updateStatus,
}))
vi.mock('../../src/common/event-bus.js', () => ({
  eventBus: {
    publish: state.publish,
  },
}))

import { registerDeviceMqttHandlers } from '../../src/modules/devices/device.mqtt.handler.js'

describe('Device MQTT handler', () => {
  it('does not record attendance from the legacy check-in topic', async () => {
    registerDeviceMqttHandlers()
    await state.listener('attendance/devices/device1/check-in', Buffer.from(JSON.stringify({ employeeId: 'employee1' })))
    expect(state.checkIn).not.toHaveBeenCalled()
  })

  it('awaits updateStatus and publishes device details record upon status change', async () => {
    const mockDevice = { id: 'device-123', device_name: 'Camera Entry', status: 'ONLINE' }
    state.updateStatus.mockResolvedValueOnce(mockDevice)

    await state.listener('attendance/devices/device-123/status', Buffer.from(JSON.stringify({ status: 'ONLINE' })))

    expect(state.updateStatus).toHaveBeenCalledWith('device-123', 'ONLINE')
    expect(state.publish).toHaveBeenCalledWith('device:status-changed', {
      deviceId: 'device-123',
      status: 'ONLINE',
      details: mockDevice,
    })
    // Ensure details is an actual resolved record object, NOT a Promise
    const publishArgs = state.publish.mock.calls[0][1]
    expect(publishArgs.details).not.toBeInstanceOf(Promise)
    expect(publishArgs.details.id).toBe('device-123')
  })

  it('does not publish status event when device is not found in database', async () => {
    state.publish.mockClear()
    state.updateStatus.mockResolvedValueOnce(null)

    await state.listener('attendance/devices/unknown-device/status', Buffer.from(JSON.stringify({ status: 'ONLINE' })))

    expect(state.updateStatus).toHaveBeenCalledWith('unknown-device', 'ONLINE')
    expect(state.publish).not.toHaveBeenCalled()
  })
})

