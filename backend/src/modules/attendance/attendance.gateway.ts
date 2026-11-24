import { attendanceRecipientRooms } from './attendance.recipients.js'
import type { Server } from 'socket.io'
import { eventBus, type AttendanceRecipientMeta } from '../../common/event-bus.js'
import { socketAuthMiddleware, refreshNamespaceScopes, enqueueNamespaceTask } from '../../sockets/socket.auth.js'

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

export type QueuedAttendanceEmission = {
  event: string
  payload: unknown
  recipientMeta?: AttendanceRecipientMeta | null
}

function sameRecipientMeta(
  a?: AttendanceRecipientMeta | null,
  b?: AttendanceRecipientMeta | null,
): boolean {
  if (a === undefined || b === undefined) return false
  if (a === null || b === null) return a === b
  return (
    a.id === b.id &&
    a.departmentId === b.departmentId &&
    a.user_id === b.user_id &&
    a.isManager === b.isManager
  )
}

let tickBuffer: QueuedAttendanceEmission[] = []
let tickScheduledPromise: Promise<void> | null = null

export const emitAttendanceEventsBatch = async (
  events: ReadonlyArray<QueuedAttendanceEmission>,
  defaultRecipientMeta?: AttendanceRecipientMeta | null,
): Promise<void> => {
  if (!io || events.length === 0) return
  const nsp = io.of('/attendance')
  if (nsp.sockets.size === 0) return

  for (const ev of events) {
    tickBuffer.push({
      event: ev.event,
      payload: ev.payload,
      recipientMeta: ev.recipientMeta !== undefined ? ev.recipientMeta : defaultRecipientMeta,
    })
  }

  if (!tickScheduledPromise) {
    // Register into the namespace queue synchronously BEFORE yielding control,
    // coalescing synchronous same-turn domain events (e.g. summary-updated + checked-in)
    // into a single auth refresh while preserving exact emission order.
    const flushPromise = enqueueNamespaceTask(nsp, async () => {
      const batch = tickBuffer
      tickBuffer = []
      tickScheduledPromise = null
      if (batch.length === 0 || nsp.sockets.size === 0) return

      try {
        await refreshNamespaceScopes(nsp.sockets.values())
        if (nsp.sockets.size === 0) return

        let prevMeta: AttendanceRecipientMeta | null | undefined = undefined
        let cachedRooms: string[] | null = null

        for (const item of batch) {
          let rooms: string[]
          if (cachedRooms && sameRecipientMeta(prevMeta, item.recipientMeta)) {
            rooms = cachedRooms
          } else {
            rooms = await attendanceRecipientRooms(item.payload, item.recipientMeta)
            if (item.recipientMeta !== undefined) {
              prevMeta = item.recipientMeta
              cachedRooms = rooms
            } else {
              prevMeta = undefined
              cachedRooms = null
            }
          }
          if (!rooms.length) continue
          let recipients = nsp.to(rooms[0])
          for (const target of rooms.slice(1)) recipients = recipients.to(target)
          recipients.emit(item.event, item.payload)
        }
      } catch (error) {
        console.error('[Attendance Gateway] Unable to authorize event recipients', error)
      }
    })
    tickScheduledPromise = flushPromise
  }

  await tickScheduledPromise
}

/**
 * @internal INTERNAL USE ONLY - Do not call from controllers or services.
 * Services must publish domain events via eventBus instead.
 */
export const emitAttendanceEvent = async (
  event: string,
  payload: unknown,
  _room?: string,
  recipientMeta?: AttendanceRecipientMeta | null,
) => {
  await emitAttendanceEventsBatch([{ event, payload, recipientMeta }])
}

// Tự động lắng nghe Domain Events từ EventBus và broadcast tới Socket.IO clients
eventBus.subscribe('attendance:checked-in', (data) => {
  const payload = data.payload || data
  const events: QueuedAttendanceEmission[] = [{ event: 'checked-in', payload, recipientMeta: data.recipientMeta }]
  if (data.payload?.summary) {
    events.push({ event: 'attendance-summary-updated', payload: data.payload.summary, recipientMeta: data.recipientMeta })
  }
  void emitAttendanceEventsBatch(events)
})

eventBus.subscribe('attendance:checked-out', (data) => {
  const payload = data.payload || data
  const events: QueuedAttendanceEmission[] = [{ event: 'checked-out', payload, recipientMeta: data.recipientMeta }]
  if (data.payload?.summary) {
    events.push({ event: 'attendance-summary-updated', payload: data.payload.summary, recipientMeta: data.recipientMeta })
  }
  void emitAttendanceEventsBatch(events)
})

eventBus.subscribe('attendance:summary-updated', (data) => {
  void emitAttendanceEvent('attendance-summary-updated', data.summary, undefined, data.recipientMeta)
})

eventBus.subscribe('attendance:spoof-blocked', (data) => {
  void emitAttendanceEvent('attendance-spoof-blocked', data)
})

eventBus.subscribe('attendance:unknown', (data) => {
  void emitAttendanceEvent('attendance-unknown', data)
})

eventBus.subscribe('attendance:flagged', (data) => {
  void emitAttendanceEvent('attendance-flagged', data)
})

// WebRTCPlayer kết nối namespace /attendance để lắng nghe sự kiện đổi mode của thiết bị
eventBus.subscribe('device:mode-updated', (data) => {
  void emitAttendanceEvent('device-mode-changed', data)
})

eventBus.subscribe('device:settings-updated', (data) => {
  void emitAttendanceEvent('device-settings-changed', data)
})
