// Keep these behavioral tests independent of the auth SQL adapter (covered by auth-projection.test).
vi.mock('../../src/modules/auth/auth.read.js', () => ({ readAuthUser: async (id: string) => {
  return prisma.user.findUnique({ where: { id } })
} }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { env } from '../../src/config/env.js'
import { createFaceSession, verifyAndLoadActiveUser, passwordSession } from '../../src/modules/auth/auth.service.js'
import bcrypt from 'bcryptjs'
import { requirePasswordAuth } from '../../src/modules/auth/face-login/require-password.js'
import { prisma } from '../../src/config/database.js'
import { hasFaceLoginTemplate } from '../../src/modules/biometrics/public.js'
import { refreshSocketScope } from '../../src/sockets/socket.auth.js'
import { configureAuthBiometrics } from '../../src/modules/auth/auth.biometrics-port.js'

vi.mock('../../src/config/database.js', () => ({ prisma: { user: { findFirst: vi.fn(), findUnique: vi.fn() } } }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
vi.mock('../../src/modules/biometrics/public.js', () => ({ hasFaceLoginTemplate: vi.fn() }))
const user = () => ({ id: 'user-a', username: 'employee-a', is_active: true,
  roles: { role_name: 'EMPLOYEE' }, profile: { token_version: 1, face_login_enabled: false },
  employees: { id: 'employee-a', employee_code: 'NV001', full_name: 'Employee', status: 'ACTIVE',
    email: null, avatar_url: null, department: null, position: null } })

describe('Face sessions and sensitive actions', () => {
  beforeEach(() => { vi.clearAllMocks(); env.FACE_LOGIN_ENABLED = true
    configureAuthBiometrics({ hasFaceLoginTemplate } as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user() as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user() as any)
    vi.mocked(hasFaceLoginTemplate).mockResolvedValue(true)
  })
  it('accepts an existing Face ID without opt-in and revokes its session after the template is removed', async () => {
    const result = await createFaceSession('employee-a')
    const claims = jwt.verify(result.accessToken, env.JWT_SECRET) as jwt.JwtPayload
    expect(claims.amr).toEqual(['face'])
    expect(claims.exp! - claims.iat!).toBe(1800)
    expect((await verifyAndLoadActiveUser(result.accessToken)).amr).toEqual(['face'])
    expect(claims).not.toHaveProperty('flv')
    vi.mocked(hasFaceLoginTemplate).mockResolvedValue(false)
    await expect(verifyAndLoadActiveUser(result.accessToken)).rejects.toMatchObject({ statusCode: 401 })
  })
  it('does not issue sessions to privileged accounts or people without a valid Face ID', async () => {
    for (const role of ['ADMIN', 'MANAGER']) {
      const privileged = user(); privileged.roles.role_name = role
      vi.mocked(prisma.user.findFirst).mockResolvedValue(privileged as any)
      await expect(createFaceSession('employee-a')).rejects.toMatchObject({ statusCode: 401 })
    }
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user() as any)
    vi.mocked(hasFaceLoginTemplate).mockResolvedValue(false)
    await expect(createFaceSession('employee-a')).rejects.toMatchObject({ statusCode: 401 })
  })
  it('requires password authentication for sensitive routes', () => {
    const next = vi.fn()
    requirePasswordAuth({ user: { amr: ['face'] } } as any, {} as any, next)
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PASSWORD_REQUIRED' })
    next.mockClear()
    requirePasswordAuth({ user: { amr: ['pwd'] } } as any, {} as any, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('does not join stale socket rooms when a newer refresh arrives during the template lookup', async () => {
    let finish!: (value: boolean) => void
    vi.mocked(hasFaceLoginTemplate).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const token = jwt.sign({ id: 'user-a', username: 'employee-a', amr: ['face'], tv: 1 }, env.JWT_SECRET)
    const socket: any = { data: { token }, handshake: { auth: {} }, rooms: new Set(['socket-id']), join: vi.fn(), leave: vi.fn() }
    const refresh = refreshSocketScope(socket)
    await new Promise(resolve => setTimeout(resolve, 0))
    socket.data._refreshSeq++
    finish(true)
    await refresh
    expect(socket.join).not.toHaveBeenCalled()
  })
  it('reauthenticates by authenticated ID even when username collides with another employee code', async () => {
    const current = { ...user(), username: 'NV002', passwordHash: 'current-hash' }
    vi.mocked(prisma.user.findUnique).mockResolvedValue(current as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...user(), id: 'another-user', passwordHash: 'other-hash' } as any)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    const session = await passwordSession('user-a', 'current-password')
    expect((jwt.verify(session.accessToken, env.JWT_SECRET) as jwt.JwtPayload).id).toBe('user-a')
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })
})
