import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { authenticate } from '../../src/middlewares/auth.middleware.js'
import { authorize } from '../../src/middlewares/rbac.middleware.js'
import { refreshSocketScope } from '../../src/sockets/socket.auth.js'
import { updateProfile } from '../../src/modules/auth/profile.service.js'
import { env } from '../../src/config/env.js'
import { AppError } from '../../src/common/AppError.js'

const mockUser = {
  id: 'usr-1',
  username: 'admin_test',
  is_active: true,
  profile: { token_version: 1 } as Record<string, any>,
  roles: { role_name: 'ADMIN' },
  employees: {
    id: 'emp-1',
    employee_code: 'EMP001',
    full_name: 'Admin Test',
    status: 'ACTIVE',
    departmentId: 1,
    department: { name: 'IT' },
    position: { name: 'IT Lead', id: 1 },
  },
}

vi.mock('../../src/config/database.js', () => {
  const db = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation(async (fn: any) => fn(db))
  return { prisma: db }
})

import { prisma } from '../../src/config/database.js'

describe('Auth Revocation, Demotion & Session Isolation (P1-1 & P1-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.is_active = true
    mockUser.roles = { role_name: 'ADMIN' }
    mockUser.profile = { token_version: 1 }
    mockUser.employees.status = 'ACTIVE'
    vi.mocked(prisma.user.findUnique).mockImplementation(async () => JSON.parse(JSON.stringify(mockUser)))
    vi.mocked(prisma.user.update).mockImplementation(async ({ data }: any) => {
      if (data.profile) {
        mockUser.profile = { ...mockUser.profile, ...data.profile }
      }
      return JSON.parse(JSON.stringify(mockUser))
    })
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma))
  })

  it('rejects deactivated account even with valid signed JWT', async () => {
    const token = jwt.sign({ id: 'usr-1', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)
    const req: any = { headers: { authorization: `Bearer ${token}` } }
    const res: any = { clearCookie: vi.fn() }
    let err: any = null

    // Deactivate user in DB
    mockUser.is_active = false

    await authenticate(req, res, (e) => { err = e })
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toContain('bị khóa')
  })

  it('re-reads role from DB so demoted account cannot access admin route', async () => {
    // Old token has ADMIN role
    const oldAdminToken = jwt.sign({ id: 'usr-1', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)
    const req: any = { headers: { authorization: `Bearer ${oldAdminToken}` } }
    const res: any = { clearCookie: vi.fn() }
    let authErr: any = null

    // Demote role in DB to EMPLOYEE
    mockUser.roles = { role_name: 'EMPLOYEE' }

    await authenticate(req, res, (e) => { authErr = e })
    expect(authErr).toBeUndefined()
    expect(req.user.role).toBe('EMPLOYEE')

    // Subsequent RBAC check for ADMIN must fail
    let rbacErr: any = null
    const rbacMiddleware = authorize('ADMIN')
    rbacMiddleware(req, res, (e: any) => { rbacErr = e })
    expect(rbacErr).toBeInstanceOf(AppError)
    expect(rbacErr.statusCode).toBe(403)
  })

  it('rejects old token after password change or token_version bump', async () => {
    const oldToken = jwt.sign({ id: 'usr-1', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)
    const req: any = { headers: { authorization: `Bearer ${oldToken}` } }
    const res: any = { clearCookie: vi.fn() }
    let err: any = null

    // Bump token version after password change
    mockUser.profile = { token_version: 2, password_changed_at: new Date().toISOString() }

    await authenticate(req, res, (e) => { err = e })
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toContain('hết hạn hoặc mật khẩu đã thay đổi')
  })

  it('socket refreshScope rejects expired token, deactivated account, and revoked version', async () => {
    const activeToken = jwt.sign({ id: 'usr-1', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)
    const mockSocket: any = {
      rooms: new Set(['ADMIN', 'user:usr-1']),
      data: { token: activeToken, user: { id: 'usr-1', role: 'ADMIN', tv: 1 } },
      leave: vi.fn((r) => mockSocket.rooms.delete(r)),
      join: vi.fn((r) => mockSocket.rooms.add(r)),
    }

    // Success initially
    await refreshSocketScope(mockSocket)
    expect(mockSocket.data.user.role).toBe('ADMIN')

    // Case 1: Account deactivated
    mockUser.is_active = false
    await expect(refreshSocketScope(mockSocket)).rejects.toThrow(/Account unavailable/)

    // Case 2: Demoted
    mockUser.is_active = true
    mockUser.roles = { role_name: 'EMPLOYEE' }
    await refreshSocketScope(mockSocket)
    expect(mockSocket.data.user.role).toBe('EMPLOYEE')
    expect(mockSocket.rooms.has('ADMIN')).toBe(false)

    // Case 3: Password changed / revoked
    mockUser.profile = { token_version: 2 }
    await expect(refreshSocketScope(mockSocket)).rejects.toThrow(/Token revoked/)
  })

  it('preserves revoked token status after profile update so old token remains rejected on HTTP and socket (P1-1)', async () => {
    const oldToken = jwt.sign({ id: 'usr-1', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)

    // 1. Password changed -> account bumped to token_version 2
    mockUser.profile = { token_version: 2, password_changed_at: new Date().toISOString() }

    // Old token tv: 1 is rejected on HTTP
    const req1: any = { headers: { authorization: `Bearer ${oldToken}` } }
    let err1: any = null
    await authenticate(req1, { clearCookie: vi.fn() } as any, (e) => { err1 = e })
    expect(err1).toBeInstanceOf(AppError)
    expect(err1.statusCode).toBe(401)

    // Old token tv: 1 is rejected on Socket
    const mockSocket: any = {
      rooms: new Set(['ADMIN', 'user:usr-1']),
      data: { token: oldToken, user: { id: 'usr-1', role: 'ADMIN', tv: 1 } },
      leave: vi.fn(),
      join: vi.fn(),
    }
    await expect(refreshSocketScope(mockSocket)).rejects.toThrow(/Token revoked/)

    // 2. User updates profile
    await updateProfile('usr-1', {
      display_name: 'Admin Display Name',
      contact_email: 'admin@aiot.corp',
      phone: '0901234567',
    })

    // Verify token_version: 2 was preserved and not wiped out by updateProfile
    expect(mockUser.profile.token_version).toBe(2)
    expect(mockUser.profile.password_changed_at).toBeDefined()

    // 3. Old token tv: 1 STILL rejected on HTTP and socket
    let err2: any = null
    await authenticate(req1, { clearCookie: vi.fn() } as any, (e) => { err2 = e })
    expect(err2).toBeInstanceOf(AppError)
    expect(err2.statusCode).toBe(401)

    await expect(refreshSocketScope(mockSocket)).rejects.toThrow(/Token revoked/)
  })

  it('rejects legacy token without tv claim when account has bumped to version 2, even if issued in same second (P1-2)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    // Legacy token without tv claim, iat set to current second
    const legacyToken = jwt.sign({ id: 'usr-1', role: 'ADMIN', iat: nowSec }, env.JWT_SECRET)

    // Account bumped to token_version 2 with password_changed_at in the exact same second
    mockUser.profile = {
      token_version: 2,
      password_changed_at: new Date(nowSec * 1000).toISOString(),
    }

    // HTTP must reject legacy token
    const req: any = { headers: { authorization: `Bearer ${legacyToken}` } }
    let err: any = null
    await authenticate(req, { clearCookie: vi.fn() } as any, (e) => { err = e })
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)

    // Socket must reject legacy token
    const mockSocket: any = {
      rooms: new Set(['ADMIN', 'user:usr-1']),
      data: { token: legacyToken, user: { id: 'usr-1', role: 'ADMIN' } },
      leave: vi.fn(),
      join: vi.fn(),
    }
    await expect(refreshSocketScope(mockSocket)).rejects.toThrow(/Token revoked/)
  })

  it('fails closed when DB errors or user does not exist without test environment bypass (P1-13)', async () => {
    const token = jwt.sign({ id: 'usr-unknown', role: 'ADMIN', tv: 1 }, env.JWT_SECRET)

    // Case 1: DB query error / failure
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('DB connection pool exhausted'))
    const req1: any = { headers: { authorization: `Bearer ${token}` } }
    let err1: any = null
    await authenticate(req1, { clearCookie: vi.fn() } as any, (e) => { err1 = e })
    expect(err1).toBeInstanceOf(AppError)
    expect(err1.statusCode).toBe(401)

    // Case 2: User not found in DB
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const req2: any = { headers: { authorization: `Bearer ${token}` } }
    let err2: any = null
    await authenticate(req2, { clearCookie: vi.fn() } as any, (e) => { err2 = e })
    expect(err2).toBeInstanceOf(AppError)
    expect(err2.statusCode).toBe(401)
  })
})
