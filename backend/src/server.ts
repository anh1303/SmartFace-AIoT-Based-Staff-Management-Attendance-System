import { findBestFaceMatch } from './modules/biometrics/public.js'
import { initializeFingerprintGateway } from './modules/biometrics/fingerprint.gateway.js'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
// Server entry point
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './config/database.js'
import { connectMqtt, disconnectMqtt } from './config/mqtt.js'
import { socketAuthMiddleware } from './sockets/socket.auth.js'
import { initializeAttendanceGateway, startAttendanceCron, stopAttendanceCron } from './modules/attendance/index.js'
import { initializeDeviceGateway, registerDeviceMqttHandlers } from './modules/devices/index.js'
import { logger } from './common/logger.js'
import { initializeOperationGateway } from './modules/operations/operation.gateway.js'
import { startOperationWorker, stopOperationWorker, registerOperationHandler } from './modules/operations/operation.worker.js'
import { executeShiftBatch } from './modules/shifts/shift-batch.service.js'
import { executeEnrollment } from './modules/biometrics/biometric.jobs.js'
import { executeAccountEmail } from './modules/employees/employee.jobs.js'

const serverLogger = logger.child('Server')
const shutdownLogger = logger.child('Shutdown')

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()),
    credentials: true,
  },
})

// Authenticate all socket connections before processing
io.use(socketAuthMiddleware)

initializeAttendanceGateway(io)
initializeDeviceGateway(io)
initializeFingerprintGateway(io)
initializeOperationGateway(io)
registerOperationHandler('shifts.batch', executeShiftBatch)
registerOperationHandler('biometric.enroll', executeEnrollment)
registerOperationHandler('employee.email', executeAccountEmail)

async function start() {
  // 11. Đảm bảo kết nối CSDL Prisma hoàn tất trước khi mở kết nối MQTT và nhận message
  await prisma.$connect()
  // Prime pgvector/query-engine setup before accepting the first physical scan.
  // A synthetic unit vector performs a read only; it never records attendance.
  const warmupStarted = performance.now()
  await findBestFaceMatch('[' + ['1', ...Array(511).fill('0')].join(',') + ']')
  serverLogger.info(`Face matcher ready (${Math.round(performance.now() - warmupStarted)} ms warmup)`)
  startOperationWorker()
  serverLogger.info('Database connected successfully')

  connectMqtt()
  registerDeviceMqttHandlers()

  // Khởi động dịch vụ tự động tổng hợp chấm công định kỳ
  startAttendanceCron()

  httpServer.listen(env.PORT, () => serverLogger.info(`API listening on http://localhost:${env.PORT}`))
}

start().catch((error) => {
  serverLogger.error('Failed to start server:', error)
  process.exit(1)
})

let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  shutdownLogger.info(`Received ${signal}. Starting graceful shutdown...`)

  // 10s force-kill timeout to prevent hanging processes
  const FORCE_KILL_TIMEOUT_MS = 10000
  const forceKillTimer = setTimeout(() => {
    shutdownLogger.error(`Force kill timeout (${FORCE_KILL_TIMEOUT_MS}ms) reached. Forcing exit.`)
    process.exit(1)
  }, FORCE_KILL_TIMEOUT_MS)
  forceKillTimer.unref()

  try {
    await stopOperationWorker()
    // 1. Close Socket.IO server & disconnect connected clients
    await new Promise<void>((resolve) => {
      io.close((err) => {
        if (err) shutdownLogger.error('Socket.IO close error:', err)
        resolve()
      })
    })

    // 2. Disconnect MQTT client & Stop CronJobs cleanly
    stopAttendanceCron()
    await disconnectMqtt()

    // 3. Terminate idle keep-alive connections & close HTTP server
    if (typeof httpServer.closeIdleConnections === 'function') {
      httpServer.closeIdleConnections()
    }
    await new Promise<void>((resolve) => {
      httpServer.close((err) => {
        if (err) shutdownLogger.error('HTTP server close error:', err)
        resolve()
      })
    })

    // 4. Disconnect Prisma database client
    await prisma.$disconnect()

    shutdownLogger.info('Graceful shutdown completed cleanly.')
    clearTimeout(forceKillTimer)
    process.exit(0)
  } catch (error) {
    shutdownLogger.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => gracefulShutdown(signal))
}
