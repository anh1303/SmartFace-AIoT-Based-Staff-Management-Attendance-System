import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { env } from '../config/env.js'
import type { AuthUser } from '../middlewares/auth.middleware.js'

export function verifySocketToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  let cookieToken: string | undefined
  try {
    const cookie = socket.handshake.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('token='))
    if (cookie) cookieToken = decodeURIComponent(cookie.slice(6))
  } catch { /* malformed cookies are not credentials */ }
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
    cookieToken

  if (!token) {
    return next(new Error('Authentication required: Token missing in handshake auth'))
  }

  try {
    const decoded = verifySocketToken(token)
    socket.data.user = decoded
    next()
  } catch {
    next(new Error('Authentication failed: Invalid or expired token'))
  }
}
