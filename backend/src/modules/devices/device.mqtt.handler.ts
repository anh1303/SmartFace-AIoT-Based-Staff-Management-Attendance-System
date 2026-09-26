import crypto from 'crypto'
import { getMqttClient } from '../../config/mqtt.js'
import { env } from '../../config/env.js'
import { emitDeviceEvent } from '../../sockets/device.gateway.js'
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js'
import * as deviceService from './device.service.js'
import * as attendance from '../attendance/attendance.service.js'

export function createMqttDeviceSignature(deviceId: string, employeeId: string, timestamp: number): string {
  const message = `${deviceId}:${employeeId}:${timestamp}`
  return crypto.createHmac('sha256', env.MQTT_DEVICE_SECRET).update(message).digest('hex')
}

export function verifyMqttDeviceSignature(
  deviceId: string,
  employeeId: string,
  timestamp: number,
  signature: string,
): boolean {
  if (!timestamp || !signature) return false

  // Chống Replay Attack: Thời gian gửi tin nhắn không được quá 5 phút (300.000 ms)
  const MAX_TIME_DRIFT_MS = 5 * 60 * 1000
  const now = Date.now()
  if (Math.abs(now - Number(timestamp)) > MAX_TIME_DRIFT_MS) {
    console.warn(`⚠️ [MQTT Security] Phát hiện Replay Attack hoặc lệch thời gian từ thiết bị ${deviceId}: ${now - Number(timestamp)}ms`)
    return false
  }

  const expectedSignature = createMqttDeviceSignature(deviceId, employeeId, Number(timestamp))

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )
  } catch {
    return false
  }
}

let isRegistered = false

export function registerDeviceMqttHandlers() {
  const client = getMqttClient()
  if (!client) return

  if (isRegistered) return
  isRegistered = true

  // Xóa bớt listener cũ (nếu có) để chống duplicate event handler
  client.removeAllListeners('message')

  // Lắng nghe trạng thái thiết bị
  client.subscribe('attendance/devices/+/status')
  // Lắng nghe sự kiện check-in từ thiết bị IoT
  client.subscribe('attendance/devices/+/check-in')

  client.on('message', async (topic, buffer) => {
    try {
      const payload = JSON.parse(buffer.toString())
      const parts = topic.split('/')
      const deviceId = parts[2]
      const event = parts[3]

      if (event === 'status') {
        // Cập nhật trạng thái thiết bị (in-memory)
        const device = deviceService.updateStatus(deviceId, payload.status ?? 'OFFLINE')
        if (device) emitDeviceEvent('status', device)
      }

      if (event === 'check-in') {
        const { employeeId, timestamp, signature } = payload

        // Xác thực bảo mật chữ ký HMAC-SHA256 & Timestamp từ MQTT_DEVICE_SECRET
        if (signature || env.NODE_ENV === 'production') {
          const isValid = verifyMqttDeviceSignature(deviceId, employeeId, timestamp, signature)
          if (!isValid) {
            console.error(`❌ [MQTT Security] Gói tin check-in từ thiết bị '${deviceId}' bị TỪ CHỐI do chữ ký HMAC-SHA256 hoặc timestamp không hợp lệ!`)
            return
          }
        }

        // Nhận check-in từ thiết bị IoT (camera nhận diện khuôn mặt)
        const record = await attendance.checkIn({
          employeeId,
          device_info: `device:${deviceId}`,
          method: 'FACE',
        })
        emitAttendanceEvent('checked-in', record)
      }
    } catch (error) {
      console.error('MQTT message rejected:', error)
    }
  })
}