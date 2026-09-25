import { createServer } from 'node:http'
import { Server } from 'socket.io'
// Server entry point
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/database.js'
import { connectMqtt, disconnectMqtt } from './config/mqtt.js'
import { socketAuthMiddleware } from './sockets/socket.auth.js'
import { initializeAttendanceGateway } from './sockets/attendance.gateway.js'
import { initializeDeviceGateway } from './sockets/device.gateway.js'
import { registerDeviceMqttHandlers } from './modules/devices/device.mqtt.handler.js'

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()),
  },
})

// Authenticate all socket connections before processing
io.use(socketAuthMiddleware)

initializeAttendanceGateway(io)
initializeDeviceGateway(io)

async function start() {
  // 11. Đảm bảo kết nối CSDL Prisma hoàn tất trước khi mở kết nối MQTT và nhận message
  await prisma.$connect()
  console.log('Database connected successfully')

  connectMqtt()
  registerDeviceMqttHandlers()

  httpServer.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`))
}

start().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`)

  // 10s force-kill timeout to prevent hanging processes
  const FORCE_KILL_TIMEOUT_MS = 10000
  const forceKillTimer = setTimeout(() => {
    console.error(`[Shutdown] Force kill timeout (${FORCE_KILL_TIMEOUT_MS}ms) reached. Forcing exit.`)
    process.exit(1)
  }, FORCE_KILL_TIMEOUT_MS)
  forceKillTimer.unref()

  try {
    // 1. Close Socket.IO server & disconnect connected clients
    await new Promise<void>((resolve) => {
      io.close((err) => {
        if (err) console.error('[Shutdown] Socket.IO close error:', err)
        resolve()
      })
    })

    // 2. Disconnect MQTT client cleanly
    await disconnectMqtt()

    // 3. Terminate idle keep-alive connections & close HTTP server
    if (typeof httpServer.closeIdleConnections === 'function') {
      httpServer.closeIdleConnections()
    }
    await new Promise<void>((resolve) => {
      httpServer.close((err) => {
        if (err) console.error('[Shutdown] HTTP server close error:', err)
        resolve()
      })
    })

    // 4. Disconnect Prisma database client
    await prisma.$disconnect()

    console.log('[Shutdown] Graceful shutdown completed cleanly.')
    clearTimeout(forceKillTimer)
    process.exit(0)
  } catch (error) {
    console.error('[Shutdown] Error during graceful shutdown:', error)
    process.exit(1)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => gracefulShutdown(signal))
}

