import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { MAX_PAIR_MS } from '../attendance/attendance.policy.js'
import { findAttendanceLogByEventKey, findRecentValidAttendanceLog } from '../attendance/attendance.service.js'
import { liveSessionStates } from './fingerprint.service.js'
import { timeAttendanceStage } from '../../common/attendance-timing.js'

const scanSchema = z.object({ device_id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  event_id: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/), client_timestamp: z.coerce.number().finite().positive(),
  mode: z.enum(['AUTO','CHECK_IN','CHECK_OUT']), binding_id: z.string().uuid(), slot: z.number().int().nonnegative(),
  revision: z.number().int().positive(), match_score: z.number().int().min(0).max(65535), event_kind: z.literal('FINGERPRINT_SCAN') })
export type FingerprintScan = z.infer<typeof scanSchema>
export async function requireFingerprintBinding(tx: Prisma.TransactionClient, scan: FingerprintScan, employeeId?: string) {
  // Authorization needs revision/status/identity, not encrypted templates or avatars.
  const b = await tx.fingerprintBinding.findUnique({ where: { id: scan.binding_id }, select: {
    id: true, device_id: true, slot: true, state: true,
    template: { select: { employee_id: true, revision: true, status: true,
      employee: { select: { id: true, full_name: true, employee_code: true, status: true } } } },
  } })
  const device = await tx.fingerprintDevice.findUnique({ where: { device_id: scan.device_id } })
  if (!device?.attendance_enabled || !device.ready || (!device.wak_verified && !device.polling_fallback)
      || !device.roundtrip_verified || Date.now() - +device.last_seen > 90_000) throw AppError.forbidden('Vân tay đang ở chế độ thử nghiệm hoặc cảm biến chưa sẵn sàng')
  if (!b || b.device_id !== scan.device_id || b.slot !== scan.slot || b.state !== 'SYNCED'
      || b.template.status !== 'ACTIVE' || b.template.revision !== scan.revision
      || (employeeId && b.template.employee_id !== employeeId) || b.template.employee.status !== 'ACTIVE') throw AppError.forbidden('Binding vân tay không hợp lệ hoặc đã bị thu hồi')
  return b
}
export async function assertNoFingerprintMaintenance(tx: Prisma.TransactionClient, deviceId: string) {
  const session = await tx.fingerprintSession.findFirst({ where: { device_id: deviceId, status: { in: liveSessionStates },
    OR: [{ status: 'SYNCING' }, { expires_at: { gt: new Date() } }] } })
  if (session) throw AppError.conflict('Thiết bị đang đăng ký/đồng bộ vân tay; chờ hoàn tất')
}
export async function processFingerprintAttendance(input: unknown, actions: {
  checkIn: typeof import('../attendance/attendance.service.js').checkIn,
  checkOut: typeof import('../attendance/attendance.service.js').checkOut,
}) {
  const data = scanSchema.parse(input)
  const b = await timeAttendanceStage('fingerprint_precheck', () => requireFingerprintBinding(prisma, data))
  const employee = { id: b.template.employee_id, full_name: b.template.employee.full_name, employee_code: b.template.employee.employee_code }
  const key = createHash('sha256').update(`${data.device_id}:${data.event_id}`).digest('hex')
  // Recover the immutable original mode even when AUTO would now choose its opposite.
  const existing = await findAttendanceLogByEventKey(key)
  if (existing && (existing.employee_id !== employee.id || existing.method !== 'FINGERPRINT')) throw AppError.conflict('Event ID đã dùng cho lượt khác')
  const last = !existing && data.mode === 'AUTO' ? await findRecentValidAttendanceLog(
    employee.id,
    new Date(data.client_timestamp - MAX_PAIR_MS),
    new Date(data.client_timestamp)
  ) : null
  const mode = existing?.type || (data.mode === 'AUTO' ? last?.type === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN' : data.mode)
  const capture = { eventId: data.event_id, capturedAt: data.client_timestamp, deviceId: data.device_id,
    method: 'FINGERPRINT' as const, fingerprint: data, syncSummary: false }
  try {
    const attendance = mode === 'CHECK_OUT' ? await actions.checkOut(employee.id, `device:${data.device_id}`, undefined, capture)
      : await actions.checkIn({ employeeId: employee.id, device_info: `device:${data.device_id}`, method: 'FINGERPRINT' }, undefined, capture)
    const denied = attendance.status === 'FLAGGED' || attendance.access_denied
    return { success: !denied, matched: true, door_open: !denied && !attendance.ignored, employee,
      event_id: data.event_id, mode, method: 'FINGERPRINT', match_score: data.match_score,
      ignored: attendance.ignored, cooldown: attendance.cooldown, retry_after_seconds: attendance.retry_after_seconds,
      attendance, message: denied ? 'Từ chối điểm danh/mở cửa' : attendance.message || `${mode} thành công` }
  } catch (error: any) {
    return { success: false, matched: true, door_open: false, employee, event_id: data.event_id,
      mode, code: error.statusCode || 503, message: error instanceof AppError ? error.message : 'Chưa xác nhận được điểm danh; thử lại cùng event ID' }
  }
}
