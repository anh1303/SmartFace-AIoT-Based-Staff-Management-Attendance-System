// Keep these behavioral tests independent of the auth SQL adapter (covered by auth-projection.test).
vi.mock('../../src/modules/auth/auth.read.js', () => ({ readAuthUser: async (id: string) => {
  return db.user.findUnique({ where: { id } })
} }))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const { db, secret } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() } },
  secret: 'test-jwt-secret-at-least-32-chars-long-security',
}))

vi.mock('../../src/config/env.js', () => ({ env: { JWT_SECRET: secret } }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))

import { refreshSocketScope } from '../../src/sockets/socket.auth.js'

describe('Socket scope refresh concurrency and race conditions', () => {
  const secret = 'test-jwt-secret-at-least-32-chars-long-security'
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = secret
  })

  it('prevents an earlier, slow refresh from restoring ADMIN room after a demotion refresh', async () => {
    const rooms = new Set<string>()
    const socket: any = {
      rooms,
      data: {
        token: jwt.sign({ id: 'user-1', role: 'ADMIN' }, secret),
        user: { id: 'user-1', role: 'ADMIN' },
      },
      handshake: { auth: {}, headers: {} },
      join: vi.fn(async (room: string) => { rooms.add(room) }),
      leave: vi.fn(async (room: string) => { rooms.delete(room) }),
    }

    let resolveSlowCall!: (val: any) => void
    const slowPromise = new Promise(resolve => { resolveSlowCall = resolve })

    // 1st call: slow query returns ADMIN
    // 2nd call: fast query returns EMPLOYEE
    db.user.findUnique
      .mockImplementationOnce(async () => {
        return slowPromise
      })
      .mockImplementationOnce(async () => {
        return {
          id: 'user-1',
          is_active: true,
          roles: { role_name: 'EMPLOYEE' },
          employees: { id: 'emp-1', status: 'ACTIVE', departmentId: 1 },
          profile: { token_version: 1 },
        }
      })

    // Start 1st refresh (slow)
    const p1 = refreshSocketScope(socket)

    // Yield so Call 1 begins and enters findUnique awaiting slowPromise
    await new Promise(r => setTimeout(r, 5))

    // Update token to reflect demoted token and trigger 2nd refresh (fast)
    socket.data.token = jwt.sign({ id: 'user-1', role: 'EMPLOYEE' }, secret)
    const p2 = refreshSocketScope(socket)

    // Now resolve 1st query with old ADMIN role
    resolveSlowCall({
      id: 'user-1',
      is_active: true,
      roles: { role_name: 'ADMIN' },
      employees: { id: 'emp-1', status: 'ACTIVE', departmentId: 1 },
      profile: { token_version: 1 },
    })

    await Promise.all([p1, p2])

    // Socket must NOT have ADMIN room! It must have EMPLOYEE / user:user-1 / employee:emp-1
    expect(rooms.has('ADMIN')).toBe(false)
    expect(socket.data.user.role).toBe('EMPLOYEE')
  })

  it('prevents an earlier refresh from restoring old department room after a transfer', async () => {
    const rooms = new Set<string>()
    const socket: any = {
      rooms,
      data: {
        token: jwt.sign({ id: 'mgr-1', role: 'MANAGER' }, secret),
        user: { id: 'mgr-1', role: 'MANAGER' },
      },
      handshake: { auth: {}, headers: {} },
      join: vi.fn(async (room: string) => { rooms.add(room) }),
      leave: vi.fn(async (room: string) => { rooms.delete(room) }),
    }

    let resolveDept1!: (val: any) => void
    const slowDept1 = new Promise(resolve => { resolveDept1 = resolve })

    // 1st call: returns old department: 1
    // 2nd call: returns new department: 2
    db.user.findUnique
      .mockImplementationOnce(async () => slowDept1)
      .mockImplementationOnce(async () => ({
        id: 'mgr-1',
        is_active: true,
        roles: { role_name: 'MANAGER' },
        employees: { id: 'emp-mgr', status: 'ACTIVE', departmentId: 2 },
        profile: { token_version: 1 },
      }))

    const p1 = refreshSocketScope(socket)
    await new Promise(r => setTimeout(r, 5))
    const p2 = refreshSocketScope(socket)

    resolveDept1({
      id: 'mgr-1',
      is_active: true,
      roles: { role_name: 'MANAGER' },
      employees: { id: 'emp-mgr', status: 'ACTIVE', departmentId: 1 },
      profile: { token_version: 1 },
    })

    await Promise.all([p1, p2])

    expect(rooms.has('department:1')).toBe(false)
    expect(rooms.has('department:2')).toBe(true)
  })
})
