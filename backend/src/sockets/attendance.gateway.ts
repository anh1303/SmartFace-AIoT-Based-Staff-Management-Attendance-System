import type { Server } from 'socket.io'

let io: Server | undefined

export const initializeAttendanceGateway = (server: Server) => {
  io = server
  server.of('/attendance').on('connection', (socket) => {
    socket.emit('connected', { namespace: '/attendance' })
  })
}

export const emitAttendanceEvent = (event: string, payload: unknown) =>
  io?.of('/attendance').emit(event, payload)