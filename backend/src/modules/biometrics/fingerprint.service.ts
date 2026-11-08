import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { encryptPayload, decryptPayload } from '../../common/biometric-crypto.js'
import { eventBus } from '../../common/event-bus.js'
import { assertCanManageEmployee, findEmployeeByIdOrCode, setFingerprintEnrolledStatus, type EmployeeActor } from '../employees/public.js'
import { triggerDeviceAction } from '../devices/device.service.js'

export const liveSessionStates = ['QUEUED', 'WAITING_TOUCH_1', 'LIFT_FINGER', 'WAITING_TOUCH_2', 'VERIFIED', 'SYNCING']
const collectingStates = liveSessionStates.filter(s => s !== 'SYNCING')
export const digestTemplate = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const lockDevice = async (tx: Prisma.TransactionClient, id: string) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fingerprint-device:${id}`}))`
}
const lockEmployee = async (tx: Prisma.TransactionClient, id: string) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employee:${id}`}))`
}
function assertFreshDevice(d: any, requireRoundtrip = true) {
  if (!d?.ready || (requireRoundtrip && !d.roundtrip_verified) || (!d.wak_verified && !d.polling_fallback)
      || Date.now() - +d.last_seen > 90_000) throw AppError.conflict('Cảm biến chưa sẵn sàng hoặc chưa kiểm chứng WAK/template roundtrip')
}
/** Explicit public allowlist. Ciphertext and templates never go to Web or Socket.IO. */
export function publicFingerprintSession(s: any) {
  return { id: s.id, employee_id: s.employee_id, device_id: s.device_id, finger_name: s.finger_name,
    status: s.status, match_score: s.match_score, error: s.error, expires_at: s.expires_at }
}
function emitSession(s: any) {
  eventBus.publish('fingerprint:progress', { owner_id: s.owner_id, ...publicFingerprintSession(s) })
}
async function expire(tx: Prisma.TransactionClient, device: string) {
  await tx.fingerprintSession.updateMany({ where: { device_id: device, status: { in: collectingStates }, expires_at: { lt: new Date() } },
    data: { status: 'EXPIRED', ciphertext: null, checksum: null, error: 'Phiên lấy mẫu đã hết hạn' } })
}
async function employeeFor(actor: EmployeeActor, value: string) {
  await assertCanManageEmployee(actor, value)
  const employee = await findEmployeeByIdOrCode(value)
  if (!employee || employee.status !== 'ACTIVE') throw AppError.conflict('Nhân viên không hoạt động')
  if (employee.user_id === actor.id) throw AppError.forbidden('Không tự đăng ký/xóa sinh trắc học của chính mình')
  return employee
}
async function authorizedSession(actor: EmployeeActor, employeeId: string, sessionId: string) {
  const employee = await employeeFor(actor, employeeId)
  const s = await prisma.fingerprintSession.findUnique({ where: { id: sessionId } })
  if (!s || s.employee_id !== employee.id || s.owner_id !== actor.id) throw AppError.notFound('Không tìm thấy phiên của bạn')
  return s
}
export async function fingerprintStatus(actor: EmployeeActor, employeeId: string) {
  const employee = await employeeFor(actor, employeeId)
  const templates = await prisma.fingerprintTemplate.findMany({ where: { employee_id: employee.id, status: { in: ['ACTIVE', 'PENDING'] } },
    select: { id: true, device_id: true, revision: true, finger_name: true, match_score: true, status: true,
      bindings: { select: { state: true, error: true, synced_at: true } } }, orderBy: { revision: 'desc' } })
  return { employee_id: employee.id, templates }
}
export async function startFingerprintSession(actor: EmployeeActor, employeeId: string, deviceId: string, fingerName: string, key: string) {
  const employee = await employeeFor(actor, employeeId)
  const session = await prisma.$transaction(async tx => {
    await lockDevice(tx, deviceId); await lockEmployee(tx, employee.id)
    await assertCanManageEmployee(actor, employee.id, tx)
    await expire(tx, deviceId)
    const previous = await tx.fingerprintSession.findUnique({ where: { owner_id_key: { owner_id: actor.id!, key } } })
    if (previous) {
      if (previous.employee_id !== employee.id || previous.device_id !== deviceId || previous.finger_name !== fingerName) throw AppError.conflict('Idempotency key đã dùng cho nội dung khác')
      return previous
    }
    assertFreshDevice(await tx.fingerprintDevice.findUnique({ where: { device_id: deviceId } }), false)
    const busy = await tx.fingerprintSession.findFirst({ where: { status: { in: liveSessionStates }, OR: [{ device_id: deviceId }, { employee_id: employee.id }] } })
    if (busy) throw AppError.conflict('Pi hoặc nhân viên đang có phiên vân tay khác')
    return tx.fingerprintSession.create({ data: { employee_id: employee.id, owner_id: actor.id!, device_id: deviceId,
      finger_name: fingerName, key, expires_at: new Date(Date.now() + 180_000) } })
  })
  // The manifest also carries the job, so a lost RPC cannot lose the session.
  void triggerDeviceAction(deviceId, 'fingerprintWake', { session_id: session.id }).catch(() => undefined)
  emitSession(session)
  return publicFingerprintSession(session)
}
export async function currentFingerprintSession(actor: EmployeeActor, employeeId: string) {
  const employee = await employeeFor(actor, employeeId)
  const current = await prisma.fingerprintSession.findFirst({ where: { employee_id: employee.id, owner_id: actor.id!,
    status: { in: liveSessionStates } }, orderBy: { created_at: 'desc' } })
  if (!current) return null
  return readFingerprintSession(actor, employeeId, current.id)
}
export async function readFingerprintSession(actor: EmployeeActor, employeeId: string, id: string) {
  const s = await authorizedSession(actor, employeeId, id)
  await prisma.$transaction(async tx => { await lockDevice(tx, s.device_id); await expire(tx, s.device_id) })
  return publicFingerprintSession(await prisma.fingerprintSession.findUniqueOrThrow({ where: { id } }))
}
export async function cancelFingerprintSession(actor: EmployeeActor, employeeId: string, id: string) {
  const source = await authorizedSession(actor, employeeId, id)
  const s = await prisma.$transaction(async tx => {
    await lockDevice(tx, source.device_id); await lockEmployee(tx, source.employee_id)
    const current = await tx.fingerprintSession.findUniqueOrThrow({ where: { id } })
    if (['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(current.status)) return current
    if (current.template_id) {
      await tx.fingerprintTemplate.updateMany({ where: { id: current.template_id, status: 'PENDING' }, data: { status: 'REVOKED' } })
      await tx.fingerprintBinding.updateMany({ where: { template_id: current.template_id, state: 'PENDING' }, data: { state: 'REVOKED' } })
    }
    return tx.fingerprintSession.update({ where: { id }, data: { status: 'CANCELLED', ciphertext: null, checksum: null } })
  })
  emitSession(s); return publicFingerprintSession(s)
}
export async function confirmFingerprintSession(actor: EmployeeActor, employeeId: string, id: string, key: string) {
  const source = await authorizedSession(actor, employeeId, id)
  const s = await prisma.$transaction(async tx => {
    await lockDevice(tx, source.device_id); await lockEmployee(tx, source.employee_id)
    await assertCanManageEmployee(actor, source.employee_id, tx)
    await expire(tx, source.device_id)
    const current = await tx.fingerprintSession.findUniqueOrThrow({ where: { id } })
    if (current.confirm_key) {
      if (current.confirm_key !== key) throw AppError.conflict('Phiên đã được xác nhận bằng yêu cầu khác')
      return current
    }
    if (current.status !== 'VERIFIED' || !current.ciphertext || !current.checksum || current.match_score === null) throw AppError.conflict('Mẫu chưa sẵn sàng hoặc đã hết hạn')
    const device = await tx.fingerprintDevice.findUnique({ where: { device_id: current.device_id } }); assertFreshDevice(device)
    const slots = await tx.fingerprintBinding.findMany({ where: { device_id: current.device_id }, select: { slot: true } })
    const used = new Set(slots.map(s => s.slot)); let slot = 0
    while (used.has(slot)) slot++
    if (slot >= device!.capacity) throw AppError.conflict('Cảm biến đầy; thu hồi mẫu không dùng trước khi thay ngón')
    const latest = await tx.fingerprintTemplate.aggregate({ where: { employee_id: current.employee_id }, _max: { revision: true } })
    const template = await tx.fingerprintTemplate.create({ data: { employee_id: current.employee_id, device_id: current.device_id,
      revision: (latest._max.revision || 0) + 1, finger_name: current.finger_name, ciphertext: current.ciphertext,
      checksum: current.checksum, match_score: current.match_score } })
    await tx.fingerprintBinding.create({ data: { template_id: template.id, device_id: template.device_id, slot } })
    return tx.fingerprintSession.update({ where: { id }, data: { status: 'SYNCING', confirm_key: key, template_id: template.id,
      ciphertext: null, checksum: null } })
  })
  emitSession(s); return publicFingerprintSession(s)
}
export async function revokeFingerprint(actor: EmployeeActor, value: string) {
  const employee = await employeeFor(actor, value)
  await prisma.$transaction(async tx => {
    await lockEmployee(tx, employee.id)
    await assertCanManageEmployee(actor, employee.id, tx)
    const ids = (await tx.fingerprintTemplate.findMany({ where: { employee_id: employee.id }, select: { id: true } })).map(t => t.id)
    await tx.fingerprintBinding.updateMany({ where: { template_id: { in: ids } }, data: { state: 'REVOKED' } })
    await tx.fingerprintTemplate.updateMany({ where: { employee_id: employee.id }, data: { status: 'REVOKED' } })
    await tx.fingerprintSession.updateMany({ where: { employee_id: employee.id, status: { in: liveSessionStates } }, data: { status: 'CANCELLED', ciphertext: null, checksum: null } })
    await setFingerprintEnrolledStatus(employee.id, false, tx)
  })
  return { revoked: true }
}

const lastDeviceSeenWrite = new Map<string, number>()
const cachedDeviceState = new Map<string, any>()

const publicSessionSelect = { id: true, employee_id: true, device_id: true, finger_name: true,
  status: true, match_score: true, error: true, expires_at: true } as const

export async function fingerprintTemplateForDevice(deviceId: string, bindingId: string, revision: number, checksum: string) {
  // Assigned templates must recover even for inactive employees; attendance independently checks ACTIVE.
  const binding = await prisma.fingerprintBinding.findFirst({
    where: { id: bindingId, device_id: deviceId, state: { in: ['PENDING', 'SYNCED'] },
      template: { status: { in: ['PENDING', 'ACTIVE'] }, revision, checksum } },
    select: { template: { select: { ciphertext: true, revision: true, checksum: true } } },
  })
  if (!binding) throw AppError.notFound('Fingerprint template unavailable')
  return { revision: binding.template.revision, checksum: binding.template.checksum,
    template_b64: decryptPayload(binding.template.ciphertext, env.BIOMETRIC_ENCRYPTION_KEY).template_b64 }
}

export async function fingerprintManifest(deviceId: string, health: any, version: 1 | 2 = 1) {
  const now = Date.now()
  const lastWrite = lastDeviceSeenWrite.get(deviceId) || 0
  const cached = cachedDeviceState.get(deviceId)
  // Re-write to DB if > 20s elapsed, or if health status changed, or if not cached
  const healthChanged = !cached || cached.ready !== health.ready || cached.wak_verified !== health.wak_verified || cached.error !== health.error
  const shouldUpdateDevice = healthChanged || (now - lastWrite > 20_000)

  return prisma.$transaction(async tx => {
    await expire(tx, deviceId)
    let device: any
    if (shouldUpdateDevice) {
      device = await tx.fingerprintDevice.upsert({
        where: { device_id: deviceId },
        create: { device_id: deviceId, ...health, last_seen: new Date() },
        update: { ...health, last_seen: new Date() }
      })
      lastDeviceSeenWrite.set(deviceId, now)
      cachedDeviceState.set(deviceId, device)
    } else {
      device = cached
    }
    const session = await tx.fingerprintSession.findFirst({ where: { device_id: deviceId, status: { in: liveSessionStates } }, select: publicSessionSelect })
    const bindings = version === 2
      ? await tx.fingerprintBinding.findMany({ where: { device_id: deviceId }, select: { id: true, slot: true, template_id: true, state: true,
          template: { select: { employee_id: true, revision: true, checksum: true } } } })
      : await tx.fingerprintBinding.findMany({ where: { device_id: deviceId }, include: { template: true } })
    return { device: { polling_fallback: device?.polling_fallback ?? false, attendance_enabled: device?.attendance_enabled ?? false },
      ...(version === 2 ? { manifest_version: 2 } : {}),
      session: session ? publicFingerprintSession(session) : null,
      bindings: bindings.map(b => ({ id: b.id, slot: b.slot, template_id: b.template_id, employee_id: b.template.employee_id,
        revision: b.template.revision, checksum: b.template.checksum, state: b.state,
        ...(version === 1 && b.state !== 'REVOKED' && 'ciphertext' in b.template && Buffer.isBuffer(b.template.ciphertext)
          ? { template_b64: decryptPayload(b.template.ciphertext, env.BIOMETRIC_ENCRYPTION_KEY).template_b64 } : {}) })) }
  })
}
const nextStates: Record<string, string[]> = {
  QUEUED: ['WAITING_TOUCH_1', 'FAILED'], WAITING_TOUCH_1: ['LIFT_FINGER', 'FAILED'],
  LIFT_FINGER: ['WAITING_TOUCH_2', 'FAILED'], WAITING_TOUCH_2: ['VERIFIED', 'FAILED'],
}
export async function fingerprintProgress(deviceId: string, id: string, body: any) {
  const s = await prisma.$transaction(async tx => {
    await lockDevice(tx, deviceId); await expire(tx, deviceId)
    const current = await tx.fingerprintSession.findUnique({ where: { id } })
    if (!current || current.device_id !== deviceId) throw AppError.notFound('Phiên không thuộc thiết bị')
    if (current.status === body.status) return current
    if (!nextStates[current.status]?.includes(body.status)) throw AppError.conflict('Phiên đã kết thúc hoặc bước không hợp lệ')
    if (body.status === 'VERIFIED') {
      const bytes = Buffer.from(body.template_b64 || '', 'base64')
      if (![512, 768].includes(bytes.length) || bytes.toString('base64') !== body.template_b64 || !Number.isInteger(body.match_score)
          || body.match_score < 0 || body.match_score > 65535 || body.roundtrip_verified !== true) throw AppError.badRequest('Template hoặc kiểm chứng roundtrip không hợp lệ')
      // Reject duplicate slots owned by another employee. Device checked its complete manifest before capture.
      const device = await tx.fingerprintDevice.findUnique({ where: { device_id: deviceId } }); assertFreshDevice(device)
      if (body.duplicate_binding_id) {
        const duplicate = await tx.fingerprintBinding.findUnique({ where: { id: body.duplicate_binding_id }, include: { template: true } })
        if (!duplicate || duplicate.device_id !== deviceId || duplicate.state === 'REVOKED') throw AppError.conflict('Mapping kiểm tra trùng đã thay đổi')
        if (duplicate.template.employee_id !== current.employee_id) throw AppError.conflict('Ngón tay đã thuộc nhân viên khác trên Pi này')
      }
      return tx.fingerprintSession.update({ where: { id }, data: { status: 'VERIFIED', match_score: body.match_score,
        ciphertext: encryptPayload({ template_b64: body.template_b64 }, env.BIOMETRIC_ENCRYPTION_KEY),
        checksum: digestTemplate(bytes), expires_at: new Date(Date.now() + 600_000), error: null } })
    }
    return tx.fingerprintSession.update({ where: { id }, data: { status: body.status, error: body.status === 'FAILED' ? ({ DUPLICATE_FINGER: 'Ngón tay đã thuộc hồ sơ khác hoặc slot chưa được quản lý', NO_MATCH: 'Hai lần đặt ngón tay không khớp', ROUNDTRIP_FAILED: 'Không khôi phục được template đã tải lên', CAPTURE_TIMEOUT: 'Hết thời gian lấy mẫu', TRANSPORT_ERROR: 'Lỗi giao tiếp cảm biến; kiểm tra thiết bị' } as Record<string, string>)[body.error_code || ''] || 'Lấy mẫu thất bại; thử lại trên thiết bị' : null,
      ...(body.status === 'FAILED' ? { ciphertext: null, checksum: null } : {}) } })
  })
  emitSession(s); return publicFingerprintSession(s)
}
export async function acknowledgeFingerprintBinding(deviceId: string, id: string, body: any) {
  let finished: any
  await prisma.$transaction(async tx => {
    await lockDevice(tx, deviceId)
    const b = await tx.fingerprintBinding.findUnique({ where: { id }, include: { template: true } })
    if (!b || b.device_id !== deviceId) throw AppError.notFound('Binding không thuộc Pi')
    await lockEmployee(tx, b.template.employee_id)
    // Re-read under employee lock to serialize with revoke and attendance.
    const current = await tx.fingerprintBinding.findUniqueOrThrow({ where: { id }, include: { template: true } })
    if (body.deleted === true) {
      if (current.state !== 'REVOKED') throw AppError.conflict('Không xóa binding còn hoạt động')
      await tx.fingerprintBinding.delete({ where: { id } }); return
    }
    if (current.state === 'REVOKED' || current.template.status === 'REVOKED') throw AppError.conflict('Mẫu đã bị thu hồi')
    if (body.error) {
      await tx.fingerprintBinding.update({ where: { id }, data: { error: 'Chưa ghi/kiểm chứng được Flash; sẽ thử lại' } }); return
    }
    if (body.checksum !== current.template.checksum || body.revision !== current.template.revision) throw AppError.conflict('Checksum/revision không khớp')
    if (current.state === 'SYNCED' && current.template.status === 'ACTIVE') return
    const old = await tx.fingerprintTemplate.findMany({ where: { employee_id: current.template.employee_id, status: 'ACTIVE' }, select: { id: true } })
    const oldIds = old.map(t => t.id).filter(i => i !== current.template_id)
    await tx.fingerprintBinding.updateMany({ where: { template_id: { in: oldIds } }, data: { state: 'REVOKED' } })
    await tx.fingerprintTemplate.updateMany({ where: { id: { in: oldIds } }, data: { status: 'REVOKED' } })
    await tx.fingerprintTemplate.update({ where: { id: current.template_id }, data: { status: 'ACTIVE' } })
    await tx.fingerprintBinding.update({ where: { id }, data: { state: 'SYNCED', error: null, synced_at: new Date() } })
    await setFingerprintEnrolledStatus(current.template.employee_id, true, tx)
    const session = await tx.fingerprintSession.findFirst({ where: { template_id: current.template_id, status: 'SYNCING' } })
    if (session) finished = await tx.fingerprintSession.update({ where: { id: session.id }, data: { status: 'COMPLETED' } })
  })
  if (finished) emitSession(finished)
  return { acknowledged: true }
}
