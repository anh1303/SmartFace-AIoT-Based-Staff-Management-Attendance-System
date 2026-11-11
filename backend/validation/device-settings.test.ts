import { describe, it, expect } from 'vitest'
import * as service from '../src/modules/devices/device.service.js'

describe('Device Settings & Quick Settings Service', () => {
  const testDeviceId = 'PI4_TEST_KIOSK'

  it('nên khởi tạo và trả về cài đặt mặc định cho thiết bị', async () => {
    const settings = await service.getDeviceSettings(testDeviceId)
    expect(settings).toBeDefined()
    expect(settings.deviceId).toBe(testDeviceId)
    expect(settings.volume).toBe(75)
    expect(settings.isMuted).toBe(false)
    expect(settings.showFps).toBe(true)
    expect(settings.streamEnabled).toBe(true)
    expect(settings.wifi.connected).toBe(false)
    expect(settings.wifi.ssid).toBe('')
    expect(settings.bluetooth.connected).toBe(false)
    expect(settings.bluetooth.status).toBe('disconnected')
  })

  it('nên cập nhật thành công âm lượng và cờ hiển thị FPS LCD', async () => {
    const updated = await service.updateDeviceSettings(testDeviceId, {
      volume: 90,
      showFps: false,
    })
    expect(updated.volume).toBe(90)
    expect(updated.showFps).toBe(false)
    expect(updated.wifi.ssid).toBe('')

    const fetched = await service.getDeviceSettings(testDeviceId)
    expect(fetched.volume).toBe(90)
    expect(fetched.showFps).toBe(false)
  })

  it('nên ghi nhận thông báo cập nhật từ phần cứng Pi (settingsNotify)', () => {
    const notified = service.recordDeviceSettingsNotify(testDeviceId, {
      volume: 60,
      bluetooth: { connected: false, deviceName: '', status: 'disconnected' },
    })
    expect(notified.volume).toBe(60)
    expect(notified.bluetooth.connected).toBe(false)
    expect(notified.bluetooth.status).toBe('disconnected')
  })

  it('nên xử lý các action quét Wi-Fi, quét Bluetooth và kết nối lại', async () => {
    const wifiScan = await service.triggerDeviceAction(testDeviceId, 'scan-wifi')
    expect(wifiScan.success).toBe(true)
    expect(Array.isArray(wifiScan.data)).toBe(true)

    const btScan = await service.triggerDeviceAction(testDeviceId, 'scan-bluetooth')
    expect(btScan.success).toBe(true)
    expect(Array.isArray(btScan.data)).toBe(true)

    await expect(service.triggerDeviceAction(testDeviceId, 'bluetooth-reconnect')).rejects.toThrow(/không thể xác nhận/)
    await expect(service.triggerDeviceAction(testDeviceId, 'bluetooth-connect', {
      name: 'HAVIT TW958 PRO', address: '01:08:51:ED:08:B9',
    })).rejects.toThrow(/không thể xác nhận/)
    await expect(service.triggerDeviceAction(testDeviceId, 'test-audio')).rejects.toThrow(/không thể xác nhận/)
    expect((await service.getDeviceSettings(testDeviceId)).bluetooth.connected).toBe(false)

  })
})
