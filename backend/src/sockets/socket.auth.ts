import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { env } from '../config/env.js'
import type { AuthUser } from '../middlewares/auth.middleware.js'
import { prisma } from '../config/database.js'
import { assertFaceSession } from '../modules/auth/public.js'

export async function refreshSocketScope(socket: Socket): Promise<void> {
  socket.data._refreshSeq = (socket.data._refreshSeq || 0) + 1
  const currentSeq = socket.data._refreshSeq
  const prevPromise = (socket.data._refreshQueue || Promise.resolve()).catch(() => {})

  const task = async () => {
    // Nếu đã có lượt refresh mới hơn được xếp hàng, bỏ qua lượt cũ này
    if (socket.data._refreshSeq > currentSeq) return

    for (const room of socket.rooms) {
      if (room === 'ADMIN' || room === 'MANAGER' || room === 'EMPLOYEE' || room.startsWith('department:') || room.startsWith('employee:') || room.startsWith('user:')) {
        await socket.leave(room)
      }
    }
    const token = (socket.data.token || socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '')) as string | undefined
    if (!token) throw new Error('Authentication required: Token missing')

    // Kiểm tra hạn token và chữ ký
    let decoded: AuthUser & { tv?: number; iat?: number }
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser & { tv?: number; iat?: number }
    } catch {
      throw new Error('Authentication failed: Invalid or expired token')
    }

    const actor = (socket.data.user || decoded) as AuthUser | undefined
    if (!actor?.id) throw new Error('Authentication required')

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        roles: true,
        employees: true,
      },
    })
    if (!user || !user.is_active) throw new Error('Authentication failed: Account unavailable')
    if (user.employees && (user.employees.status === 'TERMINATED' || user.employees.status === 'INACTIVE')) {
      throw new Error('Authentication failed: Employee inactive')
    }

    // Kiểm tra lại sau khi hoàn thành truy vấn async database:
    // Nếu có một lượt refresh mới hơn đã được phát động trong lúc chờ DB, hủy áp dụng dữ liệu cũ
    if (socket.data._refreshSeq > currentSeq) return

    const profile = (user.profile && typeof user.profile === 'object') ? (user.profile as Record<string, unknown>) : {}
    const currentTv = typeof profile.token_version === 'number' ? profile.token_version : 1
    const tokenTv = typeof decoded.tv === 'number' ? decoded.tv : 1
    await assertFaceSession(decoded.amr, user.employees?.id, user.roles.role_name)
    if (socket.data._refreshSeq > currentSeq) return
    if (decoded.amr?.includes('face') && user.employees?.status !== 'ACTIVE') {
      throw new Error('Authentication failed: Face session revoked')
    }
    if (tokenTv < currentTv) {
      throw new Error('Authentication failed: Token revoked')
    }
    if (profile.password_changed_at && decoded.iat) {
      const pwdTime = new Date(profile.password_changed_at as string).getTime()
      if (decoded.iat * 1000 < pwdTime - 1000) {
        throw new Error('Authentication failed: Password changed')
      }
    }

    const role = user.roles?.role_name?.toUpperCase()
    socket.data.token = token
    socket.data.user = { ...actor, role, employeeId: user.employees?.id }
    if (role === 'ADMIN') await socket.join('ADMIN')
    if (role === 'MANAGER' && user.employees?.departmentId) await socket.join(`department:${user.employees.departmentId}`)
    await socket.join(`user:${user.id}`)
    if (user.employees) await socket.join(`employee:${user.employees.id}`)
  }

  const currentPromise = prevPromise.then(task)
  socket.data._refreshQueue = currentPromise
  return currentPromise
}

export function verifySocketToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser
}

export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  let cookieToken: string | undefined
  try {
    const cookie = socket.handshake.headers?.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('token='))
    if (cookie) cookieToken = decodeURIComponent(cookie.slice(6))
  } catch { /* malformed cookies are not credentials */ }

  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
    cookieToken ||
    (typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : undefined)

  if (!token) {
    return next(new Error('Authentication required: Token missing in handshake auth'))
  }

  try {
    socket.data.token = token
    const decoded = verifySocketToken(token)
    socket.data.user = decoded
    await refreshSocketScope(socket)
    next()
  } catch {
    next(new Error('Authentication failed: Invalid or expired token'))
  }
}
