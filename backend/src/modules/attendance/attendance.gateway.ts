import { attendanceRecipientRooms } from './attendance.recipients.js'
import type { Server } from 'socket.io'
import { eventBus } from '../../common/event-bus.js'
import { socketAuthMiddleware, refreshSocketScope } from '../../sockets/socket.auth.js'

let io: Server | undefined

export const initializeAttendanceGateway = (server: Server) => {
  io = server
  const nsp = server.of('/attendance')
  nsp.use(socketAuthMiddleware)
  nsp.on('connection', (socket) => {
    const user = socket.data.user
    const empId = user?.employeeId
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
export const emitAttendanceEvent = async (event: string, payload: unknown, room?: string) => {
  if (!io) return
  const nsp = io.of('/attendance')
  try {
    // Refresh before delivery so department transfers and role changes revoke old subscriptions.
    await Promise.all([...nsp.sockets.values()].map(async socket => {
      try { await refreshSocketScope(socket) } catch { socket.disconnect(true) }
    }))
    const rooms = await attendanceRecipientRooms(payload)
    let recipients = nsp.to(rooms[0])
    for (const target of rooms.slice(1)) recipients = recipients.to(target)
    // Explicit rooms cannot broaden the scope of an event.
    recipients.emit(event, payload)
  } catch (error) {
    console.error('[Attendance Gateway] Unable to authorize event recipients', error)
  }
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

eventBus.subscribe('attendance:flagged', (data) => {
  emitAttendanceEvent('attendance-flagged', data)
})

// WebRTCPlayer kết nối namespace /attendance để lắng nghe sự kiện đổi mode của thiết bị
eventBus.subscribe('device:mode-updated', (data) => {
  emitAttendanceEvent('device-mode-changed', data)
})
