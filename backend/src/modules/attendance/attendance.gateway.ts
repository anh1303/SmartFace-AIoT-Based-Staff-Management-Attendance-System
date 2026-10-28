import type { Server } from 'socket.io'
import { eventBus } from '../../common/event-bus.js'
import { socketAuthMiddleware } from '../../sockets/socket.auth.js'

let io: Server | undefined

export const initializeAttendanceGateway = (server: Server) => {
  io = server
  const nsp = server.of('/attendance')
  nsp.use(socketAuthMiddleware)
  nsp.on('connection', (socket) => {
    const user = socket.data.user
    if (user?.role) {
      socket.join(user.role)
    }
    if (user?.id) {
      socket.join(`user:${user.id}`)
    }
    const empId = user?.employeeId || user?.employee_id
    if (empId) {
      socket.join(`employee:${empId}`)
    }
    socket.emit('connected', {
      namespace: '/attendance',
      user: user ? { id: user.id, role: user.role, employeeId: empId } : undefined,
    })
  })
}

/**
 * @internal INTERNAL USE ONLY - Do not call from controllers or services.
 * Services must publish domain events via eventBus instead.
 */
export const emitAttendanceEvent = (event: string, payload: unknown, room?: string) => {
  if (!io) return
  const nsp = io.of('/attendance')
  if (room) {
    nsp.to(room).emit(event, payload)
    return
  }

  // Use a union of rooms so a manager receiving their own event gets one copy.
  const p = payload as any
  const empId = p?.employee_id || p?.employeeId || p?.employee_uuid || p?.employees?.id || p?.employees?.employee_code
  const userId = p?.employee_user_id || p?.user_id || p?.userId || p?.employees?.user_id
  let recipients = nsp.to('ADMIN').to('MANAGER')
  if (empId) recipients = recipients.to(`employee:${empId}`)
  if (userId) recipients = recipients.to(`user:${userId}`)
  recipients.emit(event, payload)
}

// Tự động lắng nghe Domain Events từ EventBus và broadcast tới Socket.IO clients
eventBus.subscribe('attendance:checked-in', (data) => {
  emitAttendanceEvent('checked-in', data.payload || data)
  if (data.payload?.summary) {
    emitAttendanceEvent('attendance-summary-updated', data.payload.summary)
  }
})

eventBus.subscribe('attendance:checked-out', (data) => {
  emitAttendanceEvent('checked-out', data.payload || data)
  if (data.payload?.summary) {
    emitAttendanceEvent('attendance-summary-updated', data.payload.summary)
  }
})

eventBus.subscribe('attendance:summary-updated', (data) => {
  emitAttendanceEvent('attendance-summary-updated', data.summary)
})

eventBus.subscribe('attendance:spoof-blocked', (data) => {
  emitAttendanceEvent('attendance-spoof-blocked', data)
})

eventBus.subscribe('attendance:unknown', (data) => {
  emitAttendanceEvent('attendance-unknown', data)
})

// WebRTCPlayer kết nối namespace /attendance để lắng nghe sự kiện đổi mode của thiết bị
eventBus.subscribe('device:mode-updated', (data) => {
  emitAttendanceEvent('device-mode-changed', data)
})

eventBus.subscribe('device:settings-updated', (data) => {
  emitAttendanceEvent('device-settings-changed', data)
})
