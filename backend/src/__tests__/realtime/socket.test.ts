// Behavioral fixtures use the auth adapter boundary; SQL projection has its own regression tests.
import { prisma } from '../../config/database.js'
vi.mock('../../modules/auth/auth.read.js', () => ({
  readAuthUser: async (id: string) => prisma.user.findUnique({ where: { id } }),
}))
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createServer, type Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { io as Client, type Socket as ClientSocket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import { socketAuthMiddleware } from '../../sockets/socket.auth.js'
import { initializeAttendanceGateway, emitAttendanceEvent } from '../../modules/attendance/attendance.gateway.js'

vi.mock('../../config/database.js', () => ({ prisma: {
  user: { findUnique: async ({ where }: any) => ({ id: where.id, is_active: true, roles: { role_name: where.id.startsWith('admin') ? 'ADMIN' : 'EMPLOYEE' } }) },
  employee: { findFirst: async ({ where }: any) => where.user_id ? { id: `employee-${where.user_id}`, employee_code: `employee-${where.user_id}`, user_id: where.user_id, departmentId: 1 } : null },
} }))

describe('Realtime & Socket.IO Test (Authentication, Room Joining & Data Isolation)', () => {
  let ioServer: Server
  let httpServer: HttpServer
  let port: number

  beforeAll(async () => {
    httpServer = createServer()
    ioServer = new Server(httpServer)
    ioServer.of('/attendance').use(socketAuthMiddleware)
    initializeAttendanceGateway(ioServer)

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address()
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port
        }
        resolve()
      })
    })
  })

  afterAll(async () => {
    ioServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  it('Từ chối kết nối Socket nếu thiếu Token xác thực', async () => {
    const socket: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      autoConnect: true,
    })

    const errorMsg = await new Promise<string>((resolve) => {
      socket.on('connect_error', (err) => {
        resolve(err.message)
      })
    })

    socket.close()
    expect(errorMsg).toMatch(/Token missing/i)
  })

  it('Cho phép kết nối thành công và tự động tham gia đúng Room tương ứng với Role và User ID', async () => {
    const empToken = jwt.sign(
      { id: 'user-emp-101', role: 'EMPLOYEE', username: 'emp101' },
      env.JWT_SECRET
    )

    const socket: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      auth: { token: empToken },
      autoConnect: true,
    })

    const connectData = await new Promise<any>((resolve) => {
      socket.on('connected', (data) => resolve(data))
    })

    socket.close()
    expect(connectData.namespace).toBe('/attendance')
    expect(connectData.user.id).toBe('user-emp-101')
    expect(connectData.user.role).toBe('EMPLOYEE')
  })

  it('Cô lập dữ liệu thời gian thực: Chỉ gửi thông báo chấm công đến đúng cá nhân được chỉ định (Room Isolation)', async () => {
    const tokenEmpA = jwt.sign({ id: 'emp-A', role: 'EMPLOYEE', username: 'empA' }, env.JWT_SECRET)
    const tokenEmpB = jwt.sign({ id: 'emp-B', role: 'EMPLOYEE', username: 'empB' }, env.JWT_SECRET)

    const clientA: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      auth: { token: tokenEmpA },
    })
    const clientB: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      auth: { token: tokenEmpB },
    })

    await Promise.all([
      new Promise((res) => clientA.on('connected', res)),
      new Promise((res) => clientB.on('connected', res)),
    ])

    let receivedByA = false
    let receivedByB = false

    clientA.on('attendance:update', () => { receivedByA = true })
    clientB.on('attendance:update', () => { receivedByB = true })

    // Phát sự kiện chấm công dành riêng cho Nhân viên A
    await emitAttendanceEvent('attendance:update', { status: 'CHECKED_IN', employee_user_id: 'emp-A' })

    // Chờ 100ms để lắng nghe event
    await new Promise((res) => setTimeout(res, 100))

    clientA.close()
    clientB.close()

    expect(receivedByA).toBe(true)  // Nhân viên A nhận được
    expect(receivedByB).toBe(false) // Nhân viên B hoàn toàn không bị rò rỉ dữ liệu
  })

  it('Phát thông báo quản lý: ADMIN nhận được thông báo chấm công hệ thống nhưng EMPLOYEE không nhận', async () => {
    const tokenAdmin = jwt.sign({ id: 'admin-1', role: 'ADMIN', username: 'admin' }, env.JWT_SECRET)
    const tokenEmp = jwt.sign({ id: 'emp-1', role: 'EMPLOYEE', username: 'emp' }, env.JWT_SECRET)

    const clientAdmin: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      auth: { token: tokenAdmin },
    })
    const clientEmp: ClientSocket = Client(`http://localhost:${port}/attendance`, {
      transports: ['websocket'],
      auth: { token: tokenEmp },
    })

    await Promise.all([
      new Promise((res) => clientAdmin.on('connected', res)),
      new Promise((res) => clientEmp.on('connected', res)),
    ])

    let receivedByAdmin = false
    let receivedByEmp = false

    clientAdmin.on('attendance:new_log', () => { receivedByAdmin = true })
    clientEmp.on('attendance:new_log', () => { receivedByEmp = true })

    // Gửi sự kiện chung (bản chất gửi cho ADMIN/MANAGER room)
    await emitAttendanceEvent('attendance:new_log', { log_id: 999 })

    await new Promise((res) => setTimeout(res, 100))

    clientAdmin.close()
    clientEmp.close()

    expect(receivedByAdmin).toBe(true)
    expect(receivedByEmp).toBe(false)
  })
})
