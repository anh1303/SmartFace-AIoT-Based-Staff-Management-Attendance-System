import { createHash } from 'node:crypto'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { scanSchema, requireFingerprintBinding } from '../biometrics/fingerprint.public.js'
import { MAX_PAIR_MS } from './attendance.policy.js'
import { findAttendanceLogByEventKey, findRecentValidAttendanceLog } from './attendance.log-queries.js'

export async function processFingerprintAttendance(input: unknown, actions: {
  checkIn: typeof import('./attendance.service.js').checkIn,
  checkOut: typeof import('./attendance.service.js').checkOut,
}) {
  const data = scanSchema.parse(input)
  const b = await requireFingerprintBinding(prisma, data)
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
