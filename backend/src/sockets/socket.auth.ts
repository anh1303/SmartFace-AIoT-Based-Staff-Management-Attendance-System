import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { env } from '../config/env.js'
import type { AuthUser } from '../middlewares/auth.middleware.js'
import {
  resolveActiveSession,
  resolveActiveSessionsBatch,
  type ActiveSessionFailureReason,
  type ActiveSessionResult,
} from '../modules/auth/public.js'

const namespaceQueues = new WeakMap<object, Promise<unknown>>()

/**
 * Serializes scope refresh + room join/leave + event emit across an entire Socket.IO namespace.
 * Registers the queued promise synchronously before yielding control and isolates errors per turn
 * so a transient failure never wedges subsequent deliveries.
 */
export function enqueueNamespaceTask<T>(nsp: object, task: () => Promise<T>): Promise<T> {
  const prev = namespaceQueues.get(nsp) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(task)
  namespaceQueues.set(nsp, run.catch(() => {}))
  return run
}

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

function extractSocketToken(socket: Socket): string | undefined {
  return (socket.data.token || socket.handshake?.auth?.token || socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '')) as string | undefined
}

async function leaveScopedRooms(socket: Socket): Promise<void> {
  for (const room of [...socket.rooms]) {
    if (room === 'ADMIN' || room === 'MANAGER' || room === 'EMPLOYEE' || room.startsWith('department:') || room.startsWith('employee:') || room.startsWith('user:')) {
      await socket.leave(room)
    }
  }
}

function isTransportClosed(socket: Socket): boolean {
  const readyState = (socket as { conn?: { readyState?: string } }).conn?.readyState
  return readyState === 'closing' || readyState === 'closed' || Boolean((socket.data as { _forceDisconnected?: boolean })?._forceDisconnected)
}

async function applySocketSession(socket: Socket, token: string, session: ActiveSessionResult): Promise<void> {
  if (!session.ok) {
    throw socketSessionError(session.reason)
  }
  if (isTransportClosed(socket)) {
    return
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

export async function refreshSocketScope(socket: Socket): Promise<void> {
  socket.data._refreshSeq = (socket.data._refreshSeq || 0) + 1
  const currentSeq = socket.data._refreshSeq
  const prevPromise = (socket.data._refreshQueue || Promise.resolve()).catch(() => {})

  const task = async () => {
    if (socket.data._refreshSeq > currentSeq) return
    if (isTransportClosed(socket)) return

    await leaveScopedRooms(socket)
    const token = extractSocketToken(socket)
    if (!token) throw new Error('Authentication required: Token missing')

    let session: ActiveSessionResult
    try {
      session = await resolveActiveSession(token)
    } catch (err) {
      if (socket.data._refreshSeq > currentSeq) return
      throw err
    }

    if (socket.data._refreshSeq > currentSeq) return

    await applySocketSession(socket, token, session)
  }

  const currentPromise = prevPromise.then(task)
  socket.data._refreshQueue = currentPromise
  return currentPromise
}

/**
 * Refreshes scopes for all connected sockets in a namespace using 1 shared DB batch
 * for principals (and 1 optional batch for face templates), while verifying each socket's JWT
 * and session policy independently.
 * If the underlying DB lookup throws, propagates the error without disconnecting valid sockets
 * so the caller aborts emitting unverified events while keeping the namespace queue healthy.
 */
function isNamespaceSocketLive(socket: Socket): boolean {
  return (socket as { connected?: boolean }).connected !== false && !isTransportClosed(socket)
}

export async function refreshNamespaceScopes(sockets: Iterable<Socket>): Promise<void> {
  const list = [...sockets].filter(isNamespaceSocketLive)
  if (list.length === 0) return

  const entries = list.map(socket => {
    socket.data._refreshSeq = (socket.data._refreshSeq || 0) + 1
    return {
      socket,
      seq: socket.data._refreshSeq as number,
      prevPromise: (socket.data._refreshQueue || Promise.resolve()).catch(() => {}),
      token: extractSocketToken(socket),
    }
  })

  const runBatch = async () => {
    await Promise.all(entries.map(e => e.prevPromise))

    const activeEntries = entries.filter(
      e => e.socket.data._refreshSeq === e.seq && isNamespaceSocketLive(e.socket),
    )
    if (activeEntries.length === 0) return

    // Propagate transient DB errors BEFORE touching rooms so callers stop emitting on error
    const sessions = await resolveActiveSessionsBatch(activeEntries.map(e => e.token))

    await Promise.all(activeEntries.map(async (entry, idx) => {
      if (entry.socket.data._refreshSeq > entry.seq) return
      if (!isNamespaceSocketLive(entry.socket)) return

      await leaveScopedRooms(entry.socket)
      const session = sessions[idx]
      if (!entry.token || !session || !session.ok) {
        entry.socket.data._forceDisconnected = true
        entry.socket.disconnect(true)
        return
      }
      if (!isNamespaceSocketLive(entry.socket)) return
      await applySocketSession(entry.socket, entry.token, session)
    }))
  }

  const sharedPromise = runBatch()
  const settled = sharedPromise.catch(() => {})
  for (const entry of entries) {
    entry.socket.data._refreshQueue = settled
  }
  return sharedPromise
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
