import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as connect, Socket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
// Local socket listeners are opt-in so normal unit runs remain sandbox friendly.
const suite = process.env.RUN_SOCKET_TESTS === '1' ? describe : describe.skip
suite('Namespace authentication and broadcast isolation', () => {
  let io: Server, base: string, emitAttendance: any, emitDevice: any
  const clients: Socket[] = []
  const secret = 'isolated-socket-test-key-at-least-32-characters'
  beforeAll(async () => {
    process.env.JWT_SECRET = secret
    const { initializeAttendanceGateway, emitAttendanceEvent } = await import('../src/modules/attendance/attendance.gateway.js')
    const { initializeDeviceGateway, emitDeviceEvent } = await import('../src/modules/devices/device.gateway.js')
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
    if (namespace === '/attendance') emitAttendance('policy-check',{ok:true,employee_user_id:'admin-user'})
    else emitDevice('policy-check',{ok:true})
    await new Promise(resolve => setTimeout(resolve,50))
    expect(adminEvents).toHaveLength(1);expect(employeeEvents).toHaveLength(0)
  })
  it('delivers personal attendance to its employee without leaking to another user', async () => {
    const mine = socket('/attendance','EMPLOYEE',false,'mine'), other = socket('/attendance','EMPLOYEE',false,'other')
    await Promise.all([mine,other].map(s => new Promise<void>(resolve => s.once('connect',resolve))))
    const received: unknown[] = [], leaked: unknown[] = []
    mine.on('personal-check',v => received.push(v));other.on('personal-check',v => leaked.push(v))
    emitAttendance('personal-check',{employee_user_id:'mine'})
    await new Promise(resolve => setTimeout(resolve,50))
    expect(received).toHaveLength(1);expect(leaked).toHaveLength(0)
  })

})
