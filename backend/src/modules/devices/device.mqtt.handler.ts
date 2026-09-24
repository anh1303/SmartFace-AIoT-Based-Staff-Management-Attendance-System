import { getMqttClient } from '../../config/mqtt.js'
import { emitDeviceEvent } from '../../sockets/device.gateway.js'
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js'
import { DEVICE_STATUS, ATTENDANCE_METHOD } from '../../common/constants.js'
import * as deviceService from './device.service.js'
import * as attendance from '../attendance/attendance.service.js'

export function registerDeviceMqttHandlers() {
  const client = getMqttClient()
  if (!client) return

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
        const device = deviceService.updateStatus(deviceId, payload.status ?? DEVICE_STATUS.OFFLINE)
        if (device) emitDeviceEvent('status', device)
      }

      if (event === 'check-in') {
        // Nhận check-in từ thiết bị IoT (camera nhận diện khuôn mặt)
        const record = await attendance.checkIn({
          employeeId: payload.employeeId,
          device_info: `device:${deviceId}`,
          method: ATTENDANCE_METHOD.FACE,
        })
        emitAttendanceEvent('checked-in', record)
      }
    } catch (error) {
      console.error('MQTT message rejected:', error)
    }
  })
}
