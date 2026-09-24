import { createServer } from 'node:http'
import { Server } from 'socket.io'
// Server entry point
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/database.js'
import { connectMqtt } from './config/mqtt.js'
import { initializeAttendanceGateway } from './sockets/attendance.gateway.js'
import { initializeDeviceGateway } from './sockets/device.gateway.js'
import { registerDeviceMqttHandlers } from './modules/devices/device.mqtt.handler.js'

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()),
  },
})

initializeAttendanceGateway(io)
initializeDeviceGateway(io)
connectMqtt()
registerDeviceMqttHandlers()

async function start() {
  await prisma.$connect()
  httpServer.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`))
}

start().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    httpServer.close(() =>
      prisma.$disconnect().finally(() => process.exit(0)),
    ),
  )
}
