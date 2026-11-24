import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const mocks = vi.hoisted(() => ({
  readAuthUsers: vi.fn(),
  readAuthUser: vi.fn(),
  findActiveFaceLoginTemplateEmployeeIds: vi.fn(),
  hasFaceLoginTemplate: vi.fn(),
  findEmployeeByIdOrCode: vi.fn(),
}))

const {
  readAuthUsers,
  readAuthUser,
  findActiveFaceLoginTemplateEmployeeIds,
  hasFaceLoginTemplate,
  findEmployeeByIdOrCode,
} = mocks

vi.mock('../../modules/auth/auth.read.js', () => ({
  readAuthUser: mocks.readAuthUser,
  readAuthUsers: mocks.readAuthUsers,
}))

vi.mock('../../modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: mocks.findEmployeeByIdOrCode,
  findEmployeeByUserId: vi.fn(),
  isEmployeeManager: vi.fn((emp: any) => emp?.roles?.role_name === 'MANAGER'),
  generateUniqueEmployeeCode: vi.fn(),
  findEmployeeByEmail: vi.fn(),
  createEmployee: vi.fn(),
  findDepartmentByIdOrCode: vi.fn(),
  findPositionByName: vi.fn(),
}))

import { env } from '../../config/env.js'
import { eventBus } from '../../common/event-bus.js'
import { configureAuthBiometrics } from '../../modules/auth/auth.biometrics-port.js'
import { refreshSocketScope, refreshNamespaceScopes, socketAuthMiddleware } from '../../sockets/socket.auth.js'
import { attendanceRecipientRooms } from '../../modules/attendance/attendance.recipients.js'
import { initializeAttendanceGateway, emitAttendanceEvent } from '../../modules/attendance/attendance.gateway.js'
import { initializeOperationGateway, announceOperation, announceDataChange } from '../../modules/operations/operation.gateway.js'

function createDeferred<T>() {
  let resolve!: (val: T | PromiseLike<T>) => void
  let reject!: (err?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeFakeNamespace(initialSockets: any[]) {
  const sockets = new Map<string, any>()
  initialSockets.forEach((s, i) => {
    s.id = s.id || `sock-${i + 1}`
    if (s.connected === undefined) s.connected = true
    const origDisconnect = s.disconnect
    s.disconnect = vi.fn((close?: boolean) => {
      s.connected = false
      s.disconnected = true
      s.rooms.clear()
      sockets.delete(s.id)
      origDisconnect?.(close)
    })
    sockets.set(s.id, s)
  })
  const deliveries: Array<{ socketId: string; event: string; payload: unknown }> = []

  function makeBroadcaster(targetRooms: Set<string>, excludedRooms: Set<string>) {
    return {
      to(roomOrRooms: string | string[]) {
        const nextTargets = new Set(targetRooms)
        for (const r of Array.isArray(roomOrRooms) ? roomOrRooms : [roomOrRooms]) nextTargets.add(r)
        return makeBroadcaster(nextTargets, excludedRooms)
      },
      except(roomOrRooms: string | string[]) {
        const nextExcluded = new Set(excludedRooms)
        for (const r of Array.isArray(roomOrRooms) ? roomOrRooms : [roomOrRooms]) nextExcluded.add(r)
        return makeBroadcaster(targetRooms, nextExcluded)
      },
      emit(event: string, payload: unknown) {
        for (const sock of sockets.values()) {
          if (!sock.connected) continue
          const inTarget = [...targetRooms].some((r) => sock.rooms.has(r))
          const inExcluded = [...excludedRooms].some((r) => sock.rooms.has(r))
          if (inTarget && !inExcluded) {
            deliveries.push({ socketId: sock.id, event, payload })
          }
        }
      },
    }
  }

  const nsp: any = {
    use: vi.fn(),
    on: vi.fn(),
    sockets,
    deliveries,
    to(roomOrRooms: string | string[]) {
      const targets = new Set(Array.isArray(roomOrRooms) ? roomOrRooms : [roomOrRooms])
      return makeBroadcaster(targets, new Set())
    },
  }
  return nsp
}

function makeMockSocket(token: string, initialRooms: string[] = []) {
  const rooms = new Set<string>(initialRooms)
  const socket: any = {
    connected: true,
    disconnected: false,
    data: { token },
    handshake: { auth: { token }, headers: {} },
    rooms,
    leave: vi.fn(async (room: string) => { rooms.delete(room) }),
    join: vi.fn(async (room: string) => { if (!socket.disconnected) rooms.add(room) }),
    disconnect: vi.fn(() => { socket.connected = false; socket.disconnected = true }),
  }
  return socket
}

function makeUser(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    username: `user-${id}`,
    is_active: true,
    profile: { token_version: 2 },
    roles: { role_name: 'MANAGER' },
    employees: {
      id: `emp-${id}`,
      employee_code: `NV-${id}`,
      full_name: `User ${id}`,
      email: `${id}@test.local`,
      status: 'ACTIVE',
      departmentId: 5,
      positionId: 1,
      department: { name: 'IT' },
      position: { id: 1, name: 'Manager' },
    },
    ...overrides,
  }
}

describe('Task 2: Socket batch shared reads & per-token verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureAuthBiometrics({
      hasFaceLoginTemplate,
      findActiveFaceLoginTemplateEmployeeIds,
      findBestFaceMatch: vi.fn() as any,
    })
  })

  it('skips all DB queries when /attendance namespace has zero sockets', async () => {
    const emit = vi.fn()
    const nsp = {
      use: vi.fn(),
      on: vi.fn(),
      sockets: new Map(),
      to: vi.fn(() => ({ emit })),
    }
    const io = { of: vi.fn(() => nsp) } as any
    initializeAttendanceGateway(io)
    await emitAttendanceEvent('checked-in', { employee_id: 'NV-001' })
    expect(readAuthUsers).not.toHaveBeenCalled()
    expect(findEmployeeByIdOrCode).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('batches readAuthUsers in 1 query for 3 sockets (2 unique userIds) and immediately revokes inactive/moved users', async () => {
    const tokU1 = jwt.sign({ id: 'u1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const tokU2 = jwt.sign({ id: 'u2', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })

    const s1a = makeMockSocket(tokU1, ['department:5', 'user:u1'])
    const s1b = makeMockSocket(tokU1, ['department:5', 'user:u1'])
    const s2 = makeMockSocket(tokU2, ['department:5', 'user:u2'])

    readAuthUsers.mockResolvedValueOnce(new Map([
      ['u1', makeUser('u1', { employees: { ...makeUser('u1').employees, departmentId: 9 } })], // moved dept 5 -> 9
      ['u2', makeUser('u2', { is_active: false })], // deactivated!
    ]))

    await refreshNamespaceScopes([s1a, s1b, s2])

    expect(readAuthUsers).toHaveBeenCalledTimes(1)
    expect(new Set(readAuthUsers.mock.calls[0][0])).toEqual(new Set(['u1', 'u2']))
    expect(findActiveFaceLoginTemplateEmployeeIds).not.toHaveBeenCalled()

    expect(s1a.disconnect).not.toHaveBeenCalled()
    expect(s1a.rooms.has('department:5')).toBe(false)
    expect(s1a.rooms.has('department:9')).toBe(true)
    expect(s1b.rooms.has('department:9')).toBe(true)
    expect(s2.disconnect).toHaveBeenCalledWith(true)
  })

  it('verifies each token independently for the SAME userId: disconnects revoked tv / password-changed / expired token while keeping valid token connected', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const oldTvToken = jwt.sign({ id: 'u-same', tv: 1, amr: ['pwd'], iat: nowSec }, env.JWT_SECRET, { expiresIn: '1h' })
    const oldPwdToken = jwt.sign({ id: 'u-same', tv: 2, amr: ['pwd'], iat: nowSec - 120 }, env.JWT_SECRET, { expiresIn: '1h' })
    const expiredToken = jwt.sign({ id: 'u-same', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: -10 })
    const validToken = jwt.sign({ id: 'u-same', tv: 2, amr: ['pwd'], iat: nowSec }, env.JWT_SECRET, { expiresIn: '1h' })

    const sockOldTv = makeMockSocket(oldTvToken, ['department:5', 'user:u-same'])
    const sockOldPwd = makeMockSocket(oldPwdToken, ['department:5', 'user:u-same'])
    const sockExpired = makeMockSocket(expiredToken, ['department:5', 'user:u-same'])
    const sockValid = makeMockSocket(validToken, ['department:5', 'user:u-same'])

    readAuthUsers.mockResolvedValueOnce(new Map([
      ['u-same', makeUser('u-same', {
        profile: { token_version: 2, password_changed_at: new Date((nowSec - 30) * 1000).toISOString() },
      })],
    ]))

    await refreshNamespaceScopes([sockOldTv, sockOldPwd, sockExpired, sockValid])

    expect(readAuthUsers).toHaveBeenCalledTimes(1)
    expect(sockOldTv.disconnect).toHaveBeenCalledWith(true)
    expect(sockOldPwd.disconnect).toHaveBeenCalledWith(true)
    expect(sockExpired.disconnect).toHaveBeenCalledWith(true)
    expect(sockValid.disconnect).not.toHaveBeenCalled()
    expect(sockValid.rooms.has('user:u-same')).toBe(true)
    expect(sockValid.rooms.has('department:5')).toBe(true)
  })

  it('verifies face session independently for the SAME userId: revokes amr:[face] socket when face template removed while keeping amr:[pwd] socket connected', async () => {
    const prevFaceEnabled = env.FACE_LOGIN_ENABLED
    ;(env as any).FACE_LOGIN_ENABLED = true
    try {
      const faceToken = jwt.sign({ id: 'u-emp', tv: 1, amr: ['face'] }, env.JWT_SECRET, { expiresIn: '30m' })
      const pwdToken = jwt.sign({ id: 'u-emp', tv: 1, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })

      const sockFace = makeMockSocket(faceToken, ['user:u-emp'])
      const sockPwd = makeMockSocket(pwdToken, ['user:u-emp'])

      readAuthUsers.mockResolvedValueOnce(new Map([
        ['u-emp', makeUser('u-emp', {
          profile: { token_version: 1 },
          roles: { role_name: 'EMPLOYEE' },
        })],
      ]))
      // Face template has been deactivated/deleted -> empty set
      findActiveFaceLoginTemplateEmployeeIds.mockResolvedValueOnce(new Set<string>())

      await refreshNamespaceScopes([sockFace, sockPwd])

      expect(readAuthUsers).toHaveBeenCalledTimes(1)
      expect(findActiveFaceLoginTemplateEmployeeIds).toHaveBeenCalledTimes(1)
      expect(sockFace.disconnect).toHaveBeenCalledWith(true)
      expect(sockPwd.disconnect).not.toHaveBeenCalled()
      expect(sockPwd.rooms.has('user:u-emp')).toBe(true)
    } finally {
      ;(env as any).FACE_LOGIN_ENABLED = prevFaceEnabled
    }
  })

  it('computes attendanceRecipientRooms with 0 DB queries when recipientMeta is provided', async () => {
    const empRooms = await attendanceRecipientRooms({}, {
      id: 'emp-1',
      departmentId: 7,
      user_id: 'usr-1',
      isManager: false,
    })
    expect(empRooms).toEqual(['ADMIN', 'department:7', 'employee:emp-1', 'user:usr-1'])

    const mgrRooms = await attendanceRecipientRooms({}, {
      id: 'emp-2',
      departmentId: 7,
      user_id: 'usr-2',
      isManager: true,
    })
    expect(mgrRooms).toEqual(['ADMIN', 'employee:emp-2', 'user:usr-2'])
    expect(findEmployeeByIdOrCode).not.toHaveBeenCalled()
  })

  it('serializes overlapping /attendance deliveries so neither emits before auth finishes and no event is dropped while rooms are refreshed', async () => {
    const tokMgr = jwt.sign({ id: 'mgr-1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const sockMgr = makeMockSocket(tokMgr, ['department:5', 'user:mgr-1'])
    const attendanceNsp = makeFakeNamespace([sockMgr])
    initializeAttendanceGateway({ of: vi.fn(() => attendanceNsp) } as any)

    const d1 = createDeferred<Map<string, any>>()
    const d2 = createDeferred<Map<string, any>>()
    readAuthUsers
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise)

    const meta = { id: 'emp-10', departmentId: 5, user_id: 'u-10', isManager: false }
    const p1 = emitAttendanceEvent('attendance-summary-updated', { employee_id: 'NV-10' }, undefined, meta)
    const p2 = emitAttendanceEvent('checked-in', { id: 'log-1', employee_id: 'NV-10' }, undefined, meta)

    await Promise.resolve()
    await Promise.resolve()
    // Auth lookup is still pending -> zero events may be emitted early
    expect(attendanceNsp.deliveries).toHaveLength(0)

    const authSnapshot = new Map([['mgr-1', makeUser('mgr-1')]])
    d1.resolve(authSnapshot)
    d2.resolve(authSnapshot)
    await Promise.all([p1, p2])

    expect(attendanceNsp.deliveries.map((d: any) => d.event)).toEqual([
      'attendance-summary-updated',
      'checked-in',
    ])
  })

  it('coalesces eventBus attendance:checked-in + embedded summary into 1 auth refresh while preserving event order', async () => {
    const tokMgr = jwt.sign({ id: 'mgr-1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const sockMgr = makeMockSocket(tokMgr, ['department:5', 'user:mgr-1'])
    const attendanceNsp = makeFakeNamespace([sockMgr])
    initializeAttendanceGateway({ of: vi.fn(() => attendanceNsp) } as any)

    readAuthUsers.mockResolvedValue(new Map([['mgr-1', makeUser('mgr-1')]]))

    eventBus.publish('attendance:checked-in', {
      employeeId: 'emp-10',
      logId: '1',
      eventTime: new Date(),
      type: 'CHECK_IN',
      method: 'FACE',
      payload: { id: '1', summary: { dates: ['2026-11-24'] } },
      recipientMeta: { id: 'emp-10', departmentId: 5, user_id: 'u-10', isManager: false },
    })

    await new Promise((r) => setTimeout(r, 20))

    expect(readAuthUsers).toHaveBeenCalledTimes(1)
    expect(attendanceNsp.deliveries.map((d: any) => d.event)).toEqual([
      'checked-in',
      'attendance-summary-updated',
    ])
  })

  it('coalesces synchronous same-turn summary-updated + checked-in domain events into 1 auth refresh while preserving order', async () => {
    const tokMgr = jwt.sign({ id: 'mgr-1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const sockMgr = makeMockSocket(tokMgr, ['department:5', 'user:mgr-1'])
    const attendanceNsp = makeFakeNamespace([sockMgr])
    initializeAttendanceGateway({ of: vi.fn(() => attendanceNsp) } as any)

    readAuthUsers.mockResolvedValue(new Map([['mgr-1', makeUser('mgr-1')]]))
    const meta = { id: 'emp-10', departmentId: 5, user_id: 'u-10', isManager: false }

    eventBus.publish('attendance:summary-updated', {
      employeeId: 'emp-10',
      workDate: '2026-11-24',
      summary: { dates: ['2026-11-24'] },
      recipientMeta: meta,
    })
    eventBus.publish('attendance:checked-in', {
      employeeId: 'emp-10',
      logId: '2',
      eventTime: new Date(),
      type: 'CHECK_IN',
      method: 'MANUAL',
      payload: { id: '2' },
      recipientMeta: meta,
    })

    await new Promise((r) => setTimeout(r, 20))

    expect(readAuthUsers).toHaveBeenCalledTimes(1)
    expect(attendanceNsp.deliveries.map((d: any) => d.event)).toEqual([
      'attendance-summary-updated',
      'checked-in',
    ])
  })

  it('serializes overlapping /operations deliveries (data.changed + operation.updated) and recovers queue after DB error', async () => {
    const tokOwner = jwt.sign({ id: 'owner-1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const tokPeerMgr = jwt.sign({ id: 'mgr-peer', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const sockOwner = makeMockSocket(tokOwner, ['ADMIN', 'user:owner-1'])
    const sockPeer = makeMockSocket(tokPeerMgr, ['department:5', 'user:mgr-peer'])
    const opsNsp = makeFakeNamespace([sockOwner, sockPeer])

    initializeOperationGateway(
      { of: vi.fn(() => opsNsp) } as any,
      async (ids: readonly string[]) => ids.map((id) => ({ id, departmentId: 5 })),
      {
        authenticate: socketAuthMiddleware,
        refreshNamespace: refreshNamespaceScopes,
      },
    )

    const d1 = createDeferred<Map<string, any>>()
    const validMap = new Map([
      ['owner-1', makeUser('owner-1', { roles: { role_name: 'ADMIN' } })],
      ['mgr-peer', makeUser('mgr-peer', { roles: { role_name: 'MANAGER' } })],
    ])
    readAuthUsers
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => Promise.reject(new Error('DB transient error')))
      .mockImplementationOnce(async () => validMap)

    const op1 = announceOperation('owner-1', 'job-1', { domain: 'biometrics', employeeIds: ['emp-10'] })
    const opFail = announceDataChange('employees', ['emp-10'], 'owner-1')

    await Promise.resolve()
    expect(opsNsp.deliveries).toHaveLength(0)

    d1.resolve(validMap)
    await Promise.all([op1, opFail])

    // First announceOperation delivered data.changed to peer (not owner) then operation.updated to owner;
    // second announceDataChange failed auth DB read so it stopped without emitting stale permissions
    expect(opsNsp.deliveries).toEqual([
      {
        socketId: sockPeer.id,
        event: 'data.changed',
        payload: { domain: 'biometrics', message: 'Dữ liệu khuôn mặt vừa được cập nhật. Đang tải trạng thái mới.' },
      },
      {
        socketId: sockOwner.id,
        event: 'operation.updated',
        payload: { jobId: 'job-1' },
      },
    ])

    // Third call after DB error must still succeed (queue not wedged)
    await announceDataChange('shifts', ['emp-10'], 'owner-1')
    expect(opsNsp.deliveries).toHaveLength(3)
    expect(opsNsp.deliveries[2]).toMatchObject({
      socketId: sockPeer.id,
      event: 'data.changed',
      payload: { domain: 'shifts' },
    })
  })

  it('batches employee room metadata in 1 lookup for multi-employee operations (with duplicates & deleted IDs) while excluding owner from data.changed and keeping operation.updated', async () => {
    const tokOwner = jwt.sign({ id: 'owner-1', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const tokMgr5 = jwt.sign({ id: 'mgr-5', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })
    const tokMgr8 = jwt.sign({ id: 'mgr-8', tv: 2, amr: ['pwd'] }, env.JWT_SECRET, { expiresIn: '1h' })

    const sockOwner = makeMockSocket(tokOwner, ['ADMIN', 'user:owner-1'])
    const sockMgr5 = makeMockSocket(tokMgr5, ['department:5', 'user:mgr-5'])
    const sockMgr8 = makeMockSocket(tokMgr8, ['department:8', 'user:mgr-8'])
    const opsNsp = makeFakeNamespace([sockOwner, sockMgr5, sockMgr8])

    let dbLookupCalls = 0
    const batchLookup = vi.fn(async (ids: readonly string[]) => {
      dbLookupCalls += 1
      const rows = [
        { id: 'emp-1', departmentId: 5 },
        { id: 'emp-2', departmentId: 8 },
      ]
      return rows.filter((r) => ids.includes(r.id))
    })

    initializeOperationGateway(
      { of: vi.fn(() => opsNsp) } as any,
      batchLookup as any,
      {
        authenticate: socketAuthMiddleware,
        refreshNamespace: refreshNamespaceScopes,
      },
    )

    readAuthUsers.mockResolvedValueOnce(new Map([
      ['owner-1', makeUser('owner-1', { roles: { role_name: 'ADMIN' } })],
      ['mgr-5', makeUser('mgr-5', { employees: { ...makeUser('mgr-5').employees, departmentId: 5 } })],
      ['mgr-8', makeUser('mgr-8', { employees: { ...makeUser('mgr-8').employees, departmentId: 8 } })],
    ]))

    await announceOperation('owner-1', 'job-batch-9', {
      domain: 'shifts',
      employeeIds: ['emp-1', 'emp-2', 'emp-1', 'emp-deleted'],
    })

    expect(dbLookupCalls).toBe(1)
    // Both mgr-5 and mgr-8 get data.changed, owner-1 does NOT get data.changed, and owner-1 gets operation.updated
    expect(opsNsp.deliveries).toEqual([
      {
        socketId: sockMgr5.id,
        event: 'data.changed',
        payload: { domain: 'shifts', message: 'Lịch làm việc vừa được cập nhật. Đang tải dữ liệu mới.' },
      },
      {
        socketId: sockMgr8.id,
        event: 'data.changed',
        payload: { domain: 'shifts', message: 'Lịch làm việc vừa được cập nhật. Đang tải dữ liệu mới.' },
      },
      {
        socketId: sockOwner.id,
        event: 'operation.updated',
        payload: { jobId: 'job-batch-9' },
      },
    ])
  })
})
