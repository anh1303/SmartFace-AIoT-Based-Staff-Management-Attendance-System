import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { env } from '../config/env.js'
import type { AuthUser } from '../middlewares/auth.middleware.js'
import { resolveActiveSession, type ActiveSessionFailureReason, type ActiveSessionResult } from '../modules/auth/public.js'

function socketSessionError(reason: ActiveSessionFailureReason): Error {
  switch (reason) {
    case 'INVALID_OR_EXPIRED_TOKEN':
      return new Error('Authentication failed: Invalid or expired token')
    case 'INVALID_TOKEN_PAYLOAD':
      return new Error('Authentication required')
    case 'USER_LOOKUP_FAILED':
      return new Error('Authentication failed: Invalid user ID in token')
    case 'ACCOUNT_UNAVAILABLE':
      return new Error('Authentication failed: Account unavailable')
    case 'EMPLOYEE_INACTIVE':
      return new Error('Authentication failed: Employee inactive')
    case 'FACE_SESSION_REVOKED':
      return new Error('Authentication failed: Face session revoked')
    case 'TOKEN_REVOKED':
      return new Error('Authentication failed: Token revoked')
    case 'PASSWORD_CHANGED':
      return new Error('Authentication failed: Password changed')
  }
}

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
    const token = (socket.data.token || socket.handshake?.auth?.token || socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '')) as string | undefined
    if (!token) throw new Error('Authentication required: Token missing')

    let session: ActiveSessionResult
    try {
      session = await resolveActiveSession(token)
    } catch (err) {
      // Nếu có lượt refresh mới hơn đã được phát động trong lúc chờ xác thực, hủy áp dụng lỗi cũ
      if (socket.data._refreshSeq > currentSeq) return
      throw err
    }

    // Kiểm tra lại ngay sau khi hoàn thành xác thực async (trước cả map lỗi lẫn áp dụng state/room)
    if (socket.data._refreshSeq > currentSeq) return

    if (!session.ok) {
      throw socketSessionError(session.reason)
    }

    const { claims, socketScope } = session
    socket.data.token = token
    socket.data.user = {
      ...claims,
      id: socketScope.userId,
      role: socketScope.role,
      employeeId: socketScope.employeeId,
      departmentId: socketScope.departmentId,
    }
    if (socketScope.role === 'ADMIN') await socket.join('ADMIN')
    if (socketScope.role === 'MANAGER' && socketScope.departmentId) await socket.join(`department:${socketScope.departmentId}`)
    await socket.join(`user:${socketScope.userId}`)
    if (socketScope.employeeId) await socket.join(`employee:${socketScope.employeeId}`)
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
    await refreshSocketScope(socket)
    next()
  } catch {
    next(new Error('Authentication failed: Invalid or expired token'))
  }
}
