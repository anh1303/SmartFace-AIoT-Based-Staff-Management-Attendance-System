import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { env } from '../config/env.js'
import type { AuthUser } from '../middlewares/auth.middleware.js'
import { prisma } from '../config/database.js'

export async function refreshSocketScope(socket: Socket) {
  for (const room of socket.rooms) {
    if (room === 'ADMIN' || room === 'MANAGER' || room === 'EMPLOYEE' || room.startsWith('department:') || room.startsWith('employee:') || room.startsWith('user:')) await socket.leave(room)
  }
  const actor = socket.data.user as AuthUser | undefined
  if (!actor?.id) throw new Error('Authentication required')
  const user = await prisma.user.findUnique({ where: { id: actor.id }, include: { roles: true } })
  if (!user?.is_active) throw new Error('Authentication failed: Account unavailable')
  const employee = await prisma.employee.findFirst({ where: { user_id: user.id } })
  const role = user.roles?.role_name?.toUpperCase()
  socket.data.user = { ...actor, role, employeeId: employee?.id }
  if (role === 'ADMIN') await socket.join('ADMIN')
  if (role === 'MANAGER' && employee?.departmentId) await socket.join(`department:${employee.departmentId}`)
  await socket.join(`user:${user.id}`)
  if (employee) await socket.join(`employee:${employee.id}`)
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
    const decoded = verifySocketToken(token)
    socket.data.user = decoded
    await refreshSocketScope(socket)
    next()
  } catch {
    next(new Error('Authentication failed: Invalid or expired token'))
  }
}
