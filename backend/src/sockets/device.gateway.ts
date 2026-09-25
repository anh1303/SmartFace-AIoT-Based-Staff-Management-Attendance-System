import type { Server } from 'socket.io'

let io: Server | undefined

export const initializeDeviceGateway = (server: Server) => {
  io = server
  const nsp = server.of('/devices')
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

export const emitDeviceEvent = (event: string, payload: unknown, room?: string) => {
  if (!io) return
  const nsp = io.of('/devices')
  if (room) {
    nsp.to(room).emit(event, payload)
  } else {
    nsp.to('ADMIN').to('MANAGER').emit(event, payload)
  }
}
