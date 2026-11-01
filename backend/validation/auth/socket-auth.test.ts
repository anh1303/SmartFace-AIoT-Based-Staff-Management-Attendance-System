import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as connect, Socket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
const records = vi.hoisted(() => ({ users: new Map<string, any>(), employees: new Map<string, any>() }))
vi.mock('../../src/config/database.js', () => ({ prisma: {
  user: { findUnique: async ({ where }: any) => records.users.get(where.id) || null },
  employee: { findFirst: async ({ where }: any) => [...records.employees.values()].find(e =>
    where.user_id ? e.user_id === where.user_id : where.employee_code ? e.employee_code === where.employee_code : e.id === where.id) || null },
} }))
// Local socket listeners are opt-in so normal unit runs remain sandbox friendly.
const suite = process.env.RUN_SOCKET_TESTS === '1' ? describe : describe.skip
suite('Namespace authentication and broadcast isolation', () => {
  let io: Server, base: string, emitAttendance: any, emitDevice: any
  const clients: Socket[] = []
  const secret = 'isolated-socket-test-key-at-least-32-characters'
  beforeAll(async () => {
    for (const id of ['admin-user', 'test-user', 'mine', 'other', 'manager-a', 'manager-b']) {
      records.users.set(id, { id, is_active: true, roles: { role_name: id === 'admin-user' ? 'ADMIN' : id.startsWith('manager-') ? 'MANAGER' : 'EMPLOYEE' } })
      records.employees.set(id, { id: `employee-${id}`, employee_code: `employee-${id}`, user_id: id, departmentId: id === 'manager-b' ? 2 : 1 })
    }
    process.env.JWT_SECRET = secret
    const { initializeAttendanceGateway, emitAttendanceEvent } = await import('../../src/modules/attendance/attendance.gateway.js')
    const { initializeDeviceGateway, emitDeviceEvent } = await import('../../src/modules/devices/device.gateway.js')
    const http = createServer(); io = new Server(http)
    initializeAttendanceGateway(io);initializeDeviceGateway(io)
    emitAttendance = emitAttendanceEvent;emitDevice = emitDeviceEvent
    await new Promise<void>(resolve => http.listen(0,'127.0.0.1',resolve))
    const address = http.address() as { port: number };base = `http://127.0.0.1:${address.port}`
  })
  afterAll(async () => { clients.forEach(s => s.disconnect()); if (io) await new Promise<void>(resolve => io.close(() => resolve())) })
  function socket(namespace: string, role?: string, expired = false, userId = 'test-user') {
    const token = role && jwt.sign({id:userId,role},secret,{expiresIn:expired ? -1 : 60})
    const s = connect(base + namespace, {forceNew:true,reconnection:false,transports:['websocket'],extraHeaders:token ? {Cookie:`token=${token}`} : {}})
    clients.push(s);return s
  }
  it.each(['/attendance','/devices'])('rejects missing/expired credentials on %s', async namespace => {
    for (const role of [undefined, 'ADMIN']) {
      const s = socket(namespace,role,true)
      const error = await new Promise<Error>(resolve => s.once('connect_error',resolve))
      expect(error.message).toMatch(/Authentication/);expect(s.connected).toBe(false)
    }
  })
  it.each(['/attendance','/devices'])('sends each event once, only to authorized rooms, on %s', async namespace => {
    const admin = socket(namespace,'ADMIN',false,'admin-user'), employee = socket(namespace,'EMPLOYEE')
    await Promise.all([admin,employee].map(s => new Promise<void>(resolve => s.once('connect',resolve))))
    const adminEvents: unknown[] = [], employeeEvents: unknown[] = []
    admin.on('policy-check',v => adminEvents.push(v));employee.on('policy-check',v => employeeEvents.push(v))
    if (namespace === '/attendance') await emitAttendance('policy-check',{ok:true,employee_user_id:'admin-user'})
    else emitDevice('policy-check',{ok:true})
    await new Promise(resolve => setTimeout(resolve,50))
    expect(adminEvents).toHaveLength(1);expect(employeeEvents).toHaveLength(0)
  })
  it('delivers personal attendance to its employee without leaking to another user', async () => {
    const mine = socket('/attendance','EMPLOYEE',false,'mine'), other = socket('/attendance','EMPLOYEE',false,'other')
    await Promise.all([mine,other].map(s => new Promise<void>(resolve => s.once('connect',resolve))))
    const received: unknown[] = [], leaked: unknown[] = []
    mine.on('personal-check',v => received.push(v));other.on('personal-check',v => leaked.push(v))
    await emitAttendance('personal-check',{employee_user_id:'mine'})
    await new Promise(resolve => setTimeout(resolve,50))
    expect(received).toHaveLength(1);expect(leaked).toHaveLength(0)
  })

  it('isolates department events, revokes old rooms after a move, and keeps unknown alerts Admin-only', async () => {
    const a = socket('/attendance', 'MANAGER', false, 'manager-a'), b = socket('/attendance', 'MANAGER', false, 'manager-b')
    await Promise.all([a,b].map(s => new Promise<void>(resolve => s.once('connect',resolve))))
    const eventsA: unknown[] = [], eventsB: unknown[] = []
    a.on('department-check', value => eventsA.push(value)); b.on('department-check', value => eventsB.push(value))
    await emitAttendance('department-check', { employee_user_id: 'mine' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(eventsA).toHaveLength(1); expect(eventsB).toHaveLength(0)
    records.employees.get('manager-a').departmentId = 2
    await emitAttendance('department-check', { employee_user_id: 'mine' })
    await emitAttendance('department-check', { unknown: true })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(eventsA).toHaveLength(1); expect(eventsB).toHaveLength(0)
  })
  it('does not send shared device events to managers', async () => {
    const manager = socket('/devices', 'MANAGER', false, 'manager-a')
    await new Promise<void>(resolve => manager.once('connect',resolve))
    const received: unknown[] = []; manager.on('shared-device-check', value => received.push(value))
    await emitDevice('shared-device-check', { mode: 'CHECK_OUT' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(received).toHaveLength(0)
  })

})
