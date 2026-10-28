import type { Server } from 'socket.io'
import { eventBus } from '../../common/event-bus.js'
import { socketAuthMiddleware } from '../../sockets/socket.auth.js'

let io: Server | undefined

export const initializeDeviceGateway = (server: Server) => {
  io = server
  const nsp = server.of('/devices')
  nsp.use(socketAuthMiddleware)
  nsp.on('connection', (socket) => {
    const user = socket.data.user
    if (user?.role) {
      socket.join(user.role)
    }
    if (user?.id) {
      socket.join(`user:${user.id}`)
    }
    socket.emit('connected', {
      namespace: '/devices',
      user: user ? { id: user.id, role: user.role } : undefined,
    })
  })
}

/**
 * @internal INTERNAL USE ONLY - Do not call from controllers or services.
 * Services must publish domain events via eventBus instead.
 */
export const emitDeviceEvent = (event: string, payload: unknown, room?: string) => {
  if (!io) return
  const nsp = io.of('/devices')
  if (room) {
    nsp.to(room).emit(event, payload)
  } else {
    nsp.to('ADMIN').to('MANAGER').emit(event, payload)
  }
}

// Tự động lắng nghe Domain Events từ EventBus và broadcast tới Socket.IO clients
eventBus.subscribe('device:mode-updated', (data) => {
  emitDeviceEvent('mode-changed', { id: data.deviceId, mode: data.mode, confirmed: data.confirmed })
})

eventBus.subscribe('device:settings-updated', (data) => {
  emitDeviceEvent('settings-changed', data)
})

eventBus.subscribe('device:status-changed', (data) => {
  emitDeviceEvent('status', data.details || data)
})

eventBus.subscribe('device:created', (data) => {
  emitDeviceEvent('created', data)
})

eventBus.subscribe('device:updated', (data) => {
  emitDeviceEvent('updated', data)
})

eventBus.subscribe('device:deleted', (data) => {
  emitDeviceEvent('deleted', data)
})
