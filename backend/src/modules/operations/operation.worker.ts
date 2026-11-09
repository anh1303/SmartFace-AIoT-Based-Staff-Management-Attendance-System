import { randomUUID } from 'node:crypto'
import { prisma } from '../../config/database.js'
import { logger } from '../../common/logger.js'
import type { OperationRow } from './operation.contract.js'
import { safeError } from './operation.service.js'
import { announceOperation } from './operation.gateway.js'
import { AppError } from '../../common/AppError.js'

type Handler = (job: OperationRow) => Promise<void>
const handlers = new Map<string, Handler>()
export const registerOperationHandler = (type: string, handler: Handler) => { handlers.set(type, handler) }
let timer: ReturnType<typeof setInterval> | undefined
let busy = false
let stopping = false
let lookupActor: ((id: string) => Promise<{ id: string; is_active: boolean; roles: { role_name: string } } | null>) | undefined
export function setOperationActorLookup(lookup: NonNullable<typeof lookupActor>) { lookupActor = lookup }

export async function claimOperation(): Promise<OperationRow | undefined> {
  const token = randomUUID()
  const jobs = await prisma.$queryRaw<OperationRow[]>`UPDATE background_operations SET status = 'running', attempts = attempts + 1,
    lease_token = ${token}::uuid, lease_until = now() + interval '120 seconds', updated_at = now(), revision = revision + 1
    WHERE id = (SELECT id FROM background_operations WHERE status = 'queued' OR (status = 'running' AND lease_until < now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`
  return jobs[0]
}
export async function runOperationTick() {
  if (busy || stopping) return
  busy = true
  let heartbeat: ReturnType<typeof setInterval> | undefined
  try {
    await prisma.$executeRaw`DELETE FROM background_operation_inputs WHERE expires_at < now()`
    const job = await claimOperation()
    if (!job) return
    heartbeat = setInterval(() => {
      void prisma.$executeRaw`UPDATE background_operations SET lease_until = now() + interval '120 seconds' WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid AND status = 'running'`.catch(() => { logger.warn('Operation lease heartbeat failed') })
    }, 20000)
    heartbeat.unref()
    try {
      const handler = handlers.get(job.type)
      if (!handler) throw AppError.conflict('Loại tác vụ chưa được hỗ trợ trên phiên bản máy chủ này.')
      await handler(job)
    } catch (error) {
      await prisma.$executeRaw`UPDATE background_operations SET status = 'failed', error = ${safeError(error)}, revision = revision + 1, updated_at = now(), lease_until = NULL
        WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid AND status = 'running'`
      logger.error(`Background operation failed: ${job.type} ${job.id}`)
    }
    const states = await prisma.$queryRaw<{ status: string }[]>`SELECT status FROM background_operations WHERE id = ${job.id}::uuid`
    if (states[0]?.status !== 'running') await prisma.$executeRaw`DELETE FROM background_operation_inputs WHERE operation_id = ${job.id}::uuid`
    await announceOperation(job.owner_id, job.id)
  } catch { logger.error('Unable to poll background operations') }
  finally { if (heartbeat) clearInterval(heartbeat); busy = false }
}
export async function currentActor(ownerId: string) {
  if (!lookupActor) throw AppError.forbidden('Chưa cấu hình xác thực tác vụ')
  const user = await lookupActor(ownerId)
  if (!user?.is_active) throw AppError.forbidden('Tài khoản thực hiện tác vụ đã bị vô hiệu hóa.')
  if (!['ADMIN', 'MANAGER'].includes(user.roles.role_name.toUpperCase())) throw AppError.forbidden('Quyền quản lý đã thay đổi. Tác vụ không được thực hiện.')
  return { id: user.id, role: user.roles.role_name.toUpperCase() }
}
export function startOperationWorker() {
  stopping = false
  timer = setInterval(() => { void runOperationTick() }, 1000)
  timer.unref()
}
export async function stopOperationWorker() {
  stopping = true
  if (timer) clearInterval(timer)
  // Active DB work keeps its lease; interrupted work is recovered by the next worker.
}
