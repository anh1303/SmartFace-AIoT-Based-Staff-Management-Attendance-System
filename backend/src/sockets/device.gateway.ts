import type { Server } from 'socket.io'

let io: Server | undefined

export const initializeDeviceGateway = (server: Server) => {
  io = server
  server.of('/devices').on('connection', (socket) => {
    socket.emit('connected', { namespace: '/devices' })
  })
}

export const emitDeviceEvent = (event: string, payload: unknown) =>
  io?.of('/devices').emit(event, payload)

