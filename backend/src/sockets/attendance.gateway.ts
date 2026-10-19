import type { Server } from 'socket.io'
import { socketAuthMiddleware } from './socket.auth.js'

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
    socket.emit('connected', {
      namespace: '/attendance',
      user: user ? { id: user.id, role: user.role } : undefined,
    })
  })
}

export const emitAttendanceEvent = (event: string, payload: unknown, room?: string) => {
  if (!io) return
  const nsp = io.of('/attendance')
  if (room) {
    nsp.to(room).emit(event, payload)
  } else {
    let target = nsp.to('ADMIN').to('MANAGER')
    const userId = (payload as { employee_user_id?: string | null })?.employee_user_id
    if (userId) target = target.to(`user:${userId}`)
    target.emit(event, payload)
  }
}
