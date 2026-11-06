import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { encryptPayload, decryptPayload } from './operation.crypto.js'
import { payloadHash, publicOperation, type OperationRow } from './operation.contract.js'

export type OperationTx = Prisma.TransactionClient
export interface OperationItem { id: string; operation_id: string; item_key: string; payload: any; status: string; error: string | null }
export const safeError = (error: unknown) => error instanceof AppError ? error.message : 'Xử lý chưa thành công. Vui lòng thử lại hoặc liên hệ quản trị viên.'
export async function findOperationByKey(ownerId: string, key: string, type: string, fingerprint: unknown, tx: OperationTx = prisma) {
  const rows = await tx.$queryRaw<(OperationRow & { input_hash: string })[]>`SELECT * FROM background_operations WHERE owner_id = ${ownerId}::uuid AND idempotency_key = ${key}::uuid`
  if (rows[0] && (rows[0].type !== type || rows[0].input_hash !== payloadHash(fingerprint))) throw AppError.conflict('Mã thao tác đã được dùng cho nội dung khác.')
  return rows[0]
}

export async function enqueueOperation(tx: OperationTx, input: {
  ownerId: string; key: string; type: string; label: string; payload: any;
  fingerprint?: unknown; secret?: unknown; items?: { key: string; payload: unknown; skipped?: boolean }[];
}) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`operation:${input.ownerId}:${input.key}`}))`
  const hash = payloadHash(input.fingerprint ?? input.payload)
  const existing = await tx.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE owner_id = ${input.ownerId}::uuid AND idempotency_key = ${input.key}::uuid`
  if (existing[0]) {
    if ((existing[0] as any).input_hash !== hash || existing[0].type !== input.type) throw AppError.conflict('Mã thao tác đã được dùng cho nội dung khác.')
    return publicOperation(existing[0])
  }
  const id = randomUUID()
  const items = input.items || []
  const rows = await tx.$queryRaw<OperationRow[]>`INSERT INTO background_operations (id, owner_id, idempotency_key, input_hash, type, label, payload, total)
    VALUES (${id}::uuid, ${input.ownerId}::uuid, ${input.key}::uuid, ${hash}, ${input.type}, ${input.label}, ${JSON.stringify(input.payload)}::jsonb, ${items.length || 1}) RETURNING *`
  if (input.secret) {
    const ciphertext = encryptPayload(input.secret, env.BIOMETRIC_ENCRYPTION_KEY)
    await tx.$executeRaw`INSERT INTO background_operation_inputs(operation_id, ciphertext) VALUES (${id}::uuid, ${ciphertext})`
  }
  for (const item of items) {
    await tx.$executeRaw`INSERT INTO background_operation_items(operation_id, item_key, payload, status) VALUES (${id}::uuid, ${item.key}, ${JSON.stringify(item.payload)}::jsonb, ${item.skipped ? 'skipped' : 'queued'})`
  }
  return publicOperation(rows[0])
}

export async function readOperation(id: string, ownerId: string) {
  const rows = await prisma.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid`
  if (!rows[0]) throw AppError.notFound('Không tìm thấy tác vụ của bạn.')
  const items = await prisma.$queryRaw<Pick<OperationItem, 'item_key' | 'status' | 'error'>[]>`SELECT item_key, status, error FROM background_operation_items WHERE operation_id = ${id}::uuid ORDER BY item_key`
  return { ...publicOperation(rows[0]), items, result: rows[0].result }
}
export async function readOperationByKey(key: string, ownerId: string) {
  const rows = await prisma.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE owner_id = ${ownerId}::uuid AND idempotency_key = ${key}::uuid`
  if (!rows[0]) throw AppError.notFound('Chưa xác nhận được yêu cầu. Vui lòng kiểm tra bảng hoạt động trước khi gửi lại.')
  return { ...publicOperation(rows[0]), result: rows[0].result }
}
export async function listOperations(ownerId: string, activeOnly: boolean) {
  const rows = activeOnly
    ? await prisma.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE owner_id = ${ownerId}::uuid AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 100`
    : await prisma.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE owner_id = ${ownerId}::uuid ORDER BY CASE WHEN status IN ('queued', 'running') THEN 0 ELSE 1 END, created_at DESC LIMIT 100`
  return rows.map(publicOperation)
}
export async function retryFailedOperation(id: string, ownerId: string, key: string) {
  return prisma.$transaction(async tx => {
    const source = await tx.$queryRaw<OperationRow[]>`SELECT * FROM background_operations WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid`
    if (!source[0]) throw AppError.notFound('Không tìm thấy tác vụ của bạn.')
    if (source[0].type !== 'shifts.batch' || !['failed', 'partially_succeeded'].includes(source[0].status)) throw AppError.conflict('Tác vụ này không thể thử lại từng mục. Vui lòng gửi lại dữ liệu từ trang tương ứng.')
    const failed = await tx.$queryRaw<OperationItem[]>`SELECT * FROM background_operation_items WHERE operation_id = ${id}::uuid AND status = 'failed' ORDER BY item_key`
    if (!failed.length) throw AppError.conflict('Không có ca lỗi để thử lại.')
    return enqueueOperation(tx, { ownerId, key, type: 'shifts.batch', label: 'Thử lại các ca chưa lưu', payload: { sourceJob: id }, fingerprint: { sourceJob: id }, items: failed.map(item => ({ key: item.item_key, payload: item.payload })) })
  }, { timeout: 60000 })
}
export async function stagedInput(id: string) {
  const rows = await prisma.$queryRaw<{ ciphertext: Buffer }[]>`SELECT ciphertext FROM background_operation_inputs WHERE operation_id = ${id}::uuid AND expires_at > now()`
  if (!rows[0]) throw AppError.conflict('Dữ liệu tải lên đã hết hạn. Vui lòng gửi lại thao tác.')
  return decryptPayload(rows[0].ciphertext, env.BIOMETRIC_ENCRYPTION_KEY)
}
export async function assertNoEnrollment(tx: OperationTx, employeeId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`biometric:${employeeId}`}))`
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM background_operations WHERE type = 'biometric.enroll' AND status IN ('queued', 'running') AND payload->>'employeeId' = ${employeeId} LIMIT 1`
  if (rows.length) throw AppError.conflict('Nhân viên đang được cập nhật khuôn mặt. Vui lòng chờ tác vụ hoàn tất.')
}
