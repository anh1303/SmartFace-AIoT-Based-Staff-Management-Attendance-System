import { projectAttendanceDetails } from './attendance.details.js'
import { syncDayAdjustments, flushAdjustmentBatch } from './attendance.adjustments.js'
import { observeRecognition } from './recognition-confirmation.js'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { setImmediate as yieldToRequests } from 'node:timers/promises'
import { attendanceWorkDate, calculateDay, prepareAttendance, vnDay, MAX_PAIR_MS, roundHours } from './attendance.policy.js'
import { prisma } from '../../config/database.js'
import { assertCanManageEmployee, getEmployeeScope, type EmployeeActor } from '../../common/permission.helper.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO, formatVNTime } from '../../common/utils.js'
import { attendanceInclude } from './attendance.model.js'
import { logAction } from '../audit-logs/audit.service.js'
import { emitAttendanceEvent } from './attendance.gateway.js'
import { eventBus } from '../../common/event-bus.js'
import {
  ATTENDANCE_METHOD,
  ATTENDANCE_LOG_STATUS,
  ATTENDANCE_PUNCTUALITY,
  type AttendanceMethod,
  type AttendanceLogStatus,
  type AttendancePunctuality,
} from '../../common/constants.js'

const startOfToday = () => {
  const now = new Date()
  const vnStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  return new Date(`${vnStr}T00:00:00+07:00`)
}

export function extractTimeString(val?: string | Date | null, fallback: string = '08:00'): string {
  if (!val) return fallback
  if (val instanceof Date) {
    const hours = String(val.getUTCHours()).padStart(2, '0')
    const minutes = String(val.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val)
      const hours = String(d.getUTCHours()).padStart(2, '0')
      const minutes = String(d.getUTCMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return val.slice(0, 5)
  }
  return fallback
}

/**
 * Quy tắc làm tròn thời gian cho Tăng ca và Đi trễ / Về sớm:
 * - Từ 0 đến 29 phút: quy về phần giờ + 0 giờ
 * - Từ 30 đến 59 phút: quy về phần giờ + 0.5 giờ
 */
export function roundToHalfHour(seconds: number): number {
  if (seconds <= 0) return 0
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours + (minutes >= 30 ? 0.5 : 0)
}

export function parseTimeToSecondsInVN(d?: Date | string | null): number | null {
  if (!d) return null
  const dateObj = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dateObj.getTime())) return null
  const parts = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).split(':')
  return parseInt(parts[0] || '0', 10) * 3600 + parseInt(parts[1] || '0', 10) * 60 + parseInt(parts[2] || '0', 10)
}

export function calcShiftWorkingHours(startTimeVal?: string | Date | null, endTimeVal?: string | Date | null): number {
  const startTimeStr = extractTimeString(startTimeVal, '08:30')
  const endTimeStr = extractTimeString(endTimeVal, '17:30')
  const [sh, sm] = startTimeStr.split(':').map(Number)
  const [eh, em] = endTimeStr.split(':').map(Number)
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return 9
  const startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins < startMins) {
    endMins += 24 * 60 // Xử lý ca làm việc qua đêm
  }
  const diffMins = Math.max(0, endMins - startMins)
  return Math.round((diffMins / 60) * 100) / 100
}

export function determinePunctuality(
  type: string,
  eventTime: Date | string,
  employeeShifts?: Array<{ work_date: Date | string; start_time?: string | Date | null; end_time?: string | Date | null; shift_type?: string | null }> | null
): AttendancePunctuality {
  const eventDate = new Date(eventTime)
  const vnDateStr = eventDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

  // Tìm ca làm việc được phân công cho nhân viên vào ngày này
  const shift = employeeShifts?.find(s => {
    const shiftDateStr = formatVNDateISO(s.work_date)
    return shiftDateStr === vnDateStr
  })

  // Không có ca, hoặc ca nghỉ OFF, hoặc chưa có giờ bắt đầu/kết thúc ca -> UNRECORDED
  if (!shift || shift.shift_type === 'OFF' || !shift.start_time || !shift.end_time) {
    return ATTENDANCE_PUNCTUALITY.UNRECORDED
  }

  const shiftStartStr = extractTimeString(shift.start_time, '08:00')
  const shiftEndStr = extractTimeString(shift.end_time, '17:30')

  const [sH, sM] = shiftStartStr.split(':').map(n => parseInt(n, 10) || 0)
  const [eH, eM] = shiftEndStr.split(':').map(n => parseInt(n, 10) || 0)
  const shiftStartSec = sH * 3600 + (sM || 0) * 60
  const shiftEndSec = eH * 3600 + (eM || 0) * 60

  const vnTimeParts = eventDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).split(':')
  const eventHour = parseInt(vnTimeParts[0] || '0', 10)
  const eventMinute = parseInt(vnTimeParts[1] || '0', 10)
  const eventSecond = parseInt(vnTimeParts[2] || '0', 10)
  const eventTotalSec = eventHour * 3600 + eventMinute * 60 + eventSecond

  const GRACE_PERIOD_SECONDS = 15 * 60 // 15 phút ân hạn (grace period)

  if (type === 'CHECK_IN') {
    return eventTotalSec > (shiftStartSec + GRACE_PERIOD_SECONDS)
      ? ATTENDANCE_PUNCTUALITY.LATE
      : ATTENDANCE_PUNCTUALITY.ON_TIME
  }

  if (type === 'CHECK_OUT') {
    return eventTotalSec < shiftEndSec
      ? ATTENDANCE_PUNCTUALITY.EARLY_LEAVE
      : ATTENDANCE_PUNCTUALITY.ON_TIME
  }

  return ATTENDANCE_PUNCTUALITY.ON_TIME
}

export interface RawAttendanceLogDb {
  id: string | bigint
  event_time: Date | string
  type: string
  employee_id: string
  method?: string | null
  device_info?: string | null
  status?: string | null
  verification_score?: number | string | bigint | null
  image_url?: string | null
  employees?: {
    id?: string
    full_name?: string
    user_id?: string | null
    avatar_url?: string | null
    employee_code?: string
    employee_shifts?: Array<{ work_date: Date | string; start_time?: string | Date | null; end_time?: string | Date | null }> | null
  } | null
}

export function formatAttendanceRecord(log: RawAttendanceLogDb) {
  const eventDate = new Date(log.event_time)
  const punctuality = determinePunctuality(
    log.type,
    eventDate,
    log.employees?.employee_shifts,
  )

  return {
    id: log.id.toString(),
    employee_name: log.employees?.full_name || '',
    employee_user_id: log.employees?.user_id || null,
    avatar_url: log.employees?.avatar_url || null,
    attendance_id: `ATT-${log.id}`,
    employee_id: log.employees?.employee_code || log.employee_id,
    employee_uuid: log.employees?.id || log.employee_id,
    type: log.type as 'CHECK_IN' | 'CHECK_OUT',
    timestamp: eventDate.toISOString(),
    event_time: eventDate.toISOString(),
    method: (log.method || ATTENDANCE_METHOD.MANUAL) as AttendanceMethod,
    device_id: log.device_info || '--',
    verification_score: log.verification_score !== undefined && log.verification_score !== null ? Number(log.verification_score) : null,
    status: (log.status || ATTENDANCE_LOG_STATUS.VALID) as AttendanceLogStatus,
    punctuality,
    raw_status: log.status,
  }
}

export async function list(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = { employees: await getEmployeeScope(requesterUser) }

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await prisma.employee.findFirst({
      where: { user_id: requesterUser.id },
    })
    if (!emp) return []
    where.employee_id = emp.id
  } else {
    const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
      ? query.employeeId
      : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

    if (empIdFilter) {
      const emp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(empIdFilter),
      })
      where.employee_id = emp ? emp.id : empIdFilter
    }
  }

  const startDate = (typeof query.startDate === 'string' && query.startDate)
    ? query.startDate
    : (typeof query.from === 'string' && query.from ? query.from : undefined)

  const endDate = (typeof query.endDate === 'string' && query.endDate)
    ? query.endDate
    : (typeof query.to === 'string' && query.to ? query.to : undefined)

  const singleDate = typeof query.date === 'string' && query.date ? query.date : undefined

  if (startDate && endDate) {
    where.event_time = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
      lt: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (startDate) {
    where.event_time = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
    }
  } else if (endDate) {
    where.event_time = {
      lt: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (singleDate) {
    where.event_time = {
      gte: new Date(`${singleDate}T00:00:00+07:00`),
      lt: new Date(`${singleDate}T23:59:59.999+07:00`),
    }
  }

  if (typeof query.type === 'string') {
    where.type = query.type
  }

  const isGetAll = query.limit === 'all' || query.all === 'true' || query.all === true
  const page = Math.max(1, Number(query.page) || 1)
  const defaultLimit = 5000
  const limit = isGetAll ? 50000 : Math.min(50000, Math.max(1, Number(query.limit) || defaultLimit))
  const skip = isGetAll ? 0 : (page - 1) * limit

  const logs = await prisma.attendance_logs.findMany({
    where,
    include: attendanceInclude,
    orderBy: { event_time: 'desc' },
    skip: skip > 0 ? skip : undefined,
    take: limit,
  })

  return logs.map(formatAttendanceRecord)
}

export async function getDailySummaries(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = { employees: await getEmployeeScope(requesterUser) }

  let empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await prisma.employee.findFirst({
      where: { user_id: requesterUser.id },
    })
    if (!emp) return []
    empIdFilter = emp.id
  }

  if (empIdFilter) {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(empIdFilter),
    })
    where.employee_id = emp ? emp.id : empIdFilter
  }

  const startDate = (typeof query.startDate === 'string' && query.startDate)
    ? query.startDate
    : (typeof query.from === 'string' && query.from ? query.from : undefined)

  const endDate = (typeof query.endDate === 'string' && query.endDate)
    ? query.endDate
    : (typeof query.to === 'string' && query.to ? query.to : undefined)

  const singleDate = typeof query.date === 'string' && query.date ? query.date : undefined

  if (startDate && endDate) {
    where.work_date = {
      gte: new Date(`${startDate}T00:00:00.000Z`),
      lte: new Date(`${endDate}T00:00:00.000Z`),
    }
  } else if (startDate) {
    where.work_date = {
      gte: new Date(`${startDate}T00:00:00.000Z`),
    }
  } else if (endDate) {
    where.work_date = {
      lte: new Date(`${endDate}T00:00:00.000Z`),
    }
  } else if (singleDate) {
    where.work_date = new Date(`${singleDate}T00:00:00.000Z`)
  }

  const summaries = await prisma.daily_attendance_summary.findMany({
    where,
    include: {
      employees: {
        select: {
          id: true,
          employee_code: true,
          full_name: true,
        },
      },
    },
  })

  return summaries.map(s => ({
    id: s.id.toString(),
    employee_id: s.employees?.employee_code || s.employee_id,
    employee_uuid: s.employee_id,
    date: formatVNDateISO(s.work_date),
    total_working_hours: s.total_working_hours ? Number(s.total_working_hours) : 0,
    late_early: s.late_early ? Number(s.late_early) : 0,
    overtime: s.overtime ? Number(s.overtime) : 0,
    status: s.attendance_status,
    first_check_in: s.first_check_in,
    last_check_out: s.last_check_out,
    overtime_candidate_hours: Number(s.overtime_candidate_hours),
    overtime_status: s.overtime_status,
    overtime_reason: s.overtime_reason,
    requires_review: s.requires_review,
    review_reason: s.review_reason,
    policy_version: s.policy_version,
    calculation_details: projectAttendanceDetails(s.calculation_details, Number(s.total_working_hours), Number(s.overtime_candidate_hours)),
    regular_seconds: s.regular_seconds,
    overtime_seconds: s.overtime_seconds,
    late_early_seconds: s.late_early_seconds,
  }))
}

export async function assertEditableDay(tx: Prisma.TransactionClient, date: string, employeeId?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${date.slice(0, 7)}`}))`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${date}`}))`
  const lock = await tx.attendance_locks.findUnique({ where: { work_date: new Date(`${date}T00:00:00Z`) } })
  if (lock?.is_locked) throw AppError.conflict('Ngày công đã khóa. Cần mở khóa trước khi điều chỉnh.')
  const finalized = await tx.payrollRecord.findFirst({ where: { ...(employeeId ? { employeeId } : {}), payroll_period: date.slice(0, 7), status: { in: ['FINALIZED', 'CONFIRMED', 'PAID'] } } })
  if (finalized) throw AppError.conflict('Kỳ lương đã chốt/đã trả; cần mở khóa kỳ trước khi thay đổi công.')
}

export async function adjustAttendance(
  data: { employeeId: string; date: string; late_early: number; overtime: number; reason: string },
  actorUserId?: string,
  actorRole?: string,
) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employeeId),
    include: { users: { include: { roles: true } }, department: true, position: true },
  })
  if (!emp) throw AppError.notFound('Employee not found')
  if (!data.reason?.trim()) throw AppError.badRequest('Cần lý do điều chỉnh/duyệt OT')
  await assertCanManageEmployee({ id: actorUserId, role: actorRole }, emp.id)
  await aggregateDailyAttendance(Number(data.date.slice(5, 7)), Number(data.date.slice(0, 4)), emp.id, data.date)
  const result = await prisma.$transaction(async tx => {
    await assertEditableDay(tx, data.date, emp.id)
    await assertCanManageEmployee({ id: actorUserId, role: actorRole }, emp.id, tx)
    const key = { employee_id: emp.id, work_date: new Date(`${data.date}T00:00:00Z`) }
    const existing = await tx.daily_attendance_summary.findUnique({ where: { employee_id_work_date: key } })
    if (!existing) throw AppError.badRequest('Chưa có dữ liệu ngày công để điều chỉnh')
    const overtime = roundHours(data.overtime * 3600), late = roundHours(data.late_early * 3600)
    const updated = await tx.daily_attendance_summary.update({
      where: { id: existing.id },
      data: {
        late_early: late,
        overtime: 0,
        overtime_candidate_hours: overtime,
        manual_adjustment: true,
        overtime_status: overtime > 0 ? 'PENDING' : 'NONE',
        overtime_reason: data.reason.trim(),
        approved_by: null,
        approved_at: null,
        requires_review: false,
        review_reason: null,
      },
    })
    const adjustmentPolicy = await tx.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
    await syncDayAdjustments(tx, updated, Number(emp.hourly_rate || 0), Number(adjustmentPolicy?.absence_penalty_rate ?? 0.25))
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'ADJUST_ATTENDANCE',
        target_table: 'daily_attendance_summary',
        record_id: String(existing.id),
        old_values: { late_early: Number(existing.late_early), overtime: Number(existing.overtime), status: existing.attendance_status },
        new_values: { late_early: late, overtime, reason: data.reason.trim(), actual_ot_seconds: existing.overtime_seconds },
      },
    })
    return updated
  })

  const summaryResult = {
    id: String(result.id),
    employee_id: emp.employee_code,
    employee_uuid: emp.id,
    employee_user_id: emp.user_id,
    date: data.date,
    total_working_hours: Number(result.total_working_hours),
    late_early: Number(result.late_early),
    overtime: Number(result.overtime),
    status: result.attendance_status,
    overtime_status: result.overtime_status,
    reason: data.reason.trim(),
  }

  eventBus.publish('attendance:summary-updated', {
    employeeId: emp.id,
    workDate: data.date,
    summary: summaryResult,
  })

  return summaryResult
}

type CaptureOptions = {
  eventId?: string
  capturedAt?: number
  verificationScore?: number
  livenessScore?: number
  deviceId?: string
  verified?: boolean
}

async function recordAttendance(
  type: 'CHECK_IN' | 'CHECK_OUT',
  employeeId: string,
  device: string | undefined,
  requester: { id?: string; role?: string } | undefined,
  capture: CaptureOptions = {}
) {
  const employee = await prisma.employee.findFirst({
    where: requester?.role === 'EMPLOYEE'
      ? { user_id: requester.id }
      : buildIdOrCodeWhere(employeeId),
  })
  if (!employee) throw AppError.notFound('Employee not found')
  if (requester && requester.role?.toUpperCase() !== 'EMPLOYEE') await assertCanManageEmployee(requester, employee.id)
  if (employee.status !== 'ACTIVE') throw AppError.forbidden('Nhân viên không ở trạng thái ACTIVE')
  const eventTime = new Date(capture.capturedAt ?? Date.now())
  if (!Number.isFinite(+eventTime)) throw AppError.badRequest('Thời điểm ghi nhận không hợp lệ')
  const flagged = +eventTime > Date.now() + 120000 || +eventTime < Date.now() - MAX_PAIR_MS
  const eventKey = capture.eventId ? createHash('sha256').update(`${capture.deviceId || device || 'web'}:${capture.eventId}`).digest('hex') : undefined
  const { created, affected, duplicate } = await prisma.$transaction(async tx => {
    // Lock adjacent periods in chronological order for cross-midnight/month pairs.
    const periods = [-1, 0, 1].map(offset => { const d = new Date(eventTime); d.setUTCMonth(d.getUTCMonth() + offset, 1); return vnDay(d).slice(0, 7) }).sort()
    for (const period of periods) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    if (requester && requester.role?.toUpperCase() !== 'EMPLOYEE') await assertCanManageEmployee(requester, employee.id, tx)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employee.id}))`
    if (eventKey) {
      const existing = await tx.attendance_logs.findUnique({ where: { event_key: eventKey }, include: attendanceInclude })
      if (existing) {
        if (existing.employee_id !== employee.id || existing.type !== type) throw AppError.conflict('Event ID đã được dùng cho một lượt khác')
        return { created: existing, affected: [...new Set([vnDay(existing.work_date || existing.event_time), vnDay(existing.event_time)])], duplicate: true }
      }
    }
    const previous = await tx.attendance_logs.findFirst({
      where: { employee_id: employee.id, status: 'VALID', event_time: { lte: eventTime } },
      orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
    })
    const eventDay = new Date(`${vnDay(eventTime)}T00:00:00Z`)
    const nearShifts = await tx.employee_shifts.findMany({ where: { employee_id: employee.id, work_date: { gte: new Date(+eventDay - MAX_PAIR_MS), lte: eventDay } }, include: { work_shifts: true } })
    const schedule = nearShifts.map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
    const date = type === 'CHECK_OUT' && previous?.type === 'CHECK_IN' && +eventTime - +previous.event_time <= MAX_PAIR_MS
      ? attendanceWorkDate(previous.event_time, schedule) : attendanceWorkDate(eventTime, schedule)
    const closedPeriod = await tx.payrollRecord.findFirst({ where: { employeeId: employee.id, payroll_period: date.slice(0, 7), status: { in: ['FINALIZED', 'CONFIRMED', 'PAID'] } } })
    const created = await tx.attendance_logs.create({
      data: {
        employee_id: employee.id,
        type,
        event_time: eventTime,
        work_date: new Date(`${date}T00:00:00Z`),
        event_key: eventKey,
        method: capture.verified ? 'FACE' : 'MANUAL',
        device_info: device || 'Web',
        verification_score: capture.verificationScore,
        liveness_score: capture.livenessScore,
        status: flagged || closedPeriod ? 'FLAGGED' : 'VALID',
      },
      include: attendanceInclude,
    })
    const previousDay = previous && +eventTime - +previous.event_time <= MAX_PAIR_MS ? attendanceWorkDate(previous.event_time, schedule) : null
    const affected = [...new Set([date, vnDay(eventTime), ...(previousDay ? [previousDay] : [])])]
    for (const day of affected) {
      const closed = await tx.payrollRecord.findFirst({ where: { employeeId: employee.id, payroll_period: day.slice(0, 7), status: { in: ['FINALIZED', 'CONFIRMED', 'PAID'] } } })
      if (!closed) {
        const work_date = new Date(`${day}T00:00:00Z`)
        const invalidated = { policy_version: null, requires_review: true, review_reason: 'SOURCE_CHANGED' }
        await tx.daily_attendance_summary.upsert({
          where: { employee_id_work_date: { employee_id: employee.id, work_date } },
          update: invalidated,
          create: { employee_id: employee.id, work_date, attendance_status: 'INCOMPLETE', ...invalidated },
        })
      }
    }
    return { created, affected, duplicate: false }
  }, { timeout: 15000, maxWait: 10000 })
  // Raw logs are durable even if a summary calculation fails. A replay retries the same summaries.
  const updatedSummaries: Array<Record<string, unknown>> = []
  for (const date of affected) {
    const calculated = await aggregateDailyAttendance(Number(date.slice(5, 7)), Number(date.slice(0, 4)), employee.id, date)
    updatedSummaries.push(...calculated.details)
  }

  const result = { ...formatAttendanceRecord(created), duplicate, summaries: updatedSummaries, work_date: vnDay(created.work_date || created.event_time) }
  emitAttendanceEvent('attendance-summary-updated', { employee_id: employee.employee_code, employee_user_id: employee.user_id, dates: affected })
  if (!duplicate) eventBus.publish(type === 'CHECK_IN' ? 'attendance:checked-in' : 'attendance:checked-out', {
    employeeId: employee.id,
    logId: String(created.id),
    eventTime: created.event_time,
    type,
    method: created.method,
    deviceInfo: created.device_info,
    payload: result,
  })
  return result
}

export async function checkIn(
  data: {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    event_id?: string
    eventId?: string
    verification_score?: number | null
  },
  requesterUser?: { id?: string; role?: string },
  capture: CaptureOptions = {}
) {
  const id = data.employeeId || data.employee_id
  if (!id && requesterUser?.role !== 'EMPLOYEE') throw AppError.badRequest('employeeId is required')
  const mergedCapture: CaptureOptions = {
    ...capture,
    eventId: capture.eventId || data.eventId || data.event_id,
    verificationScore: capture.verificationScore ?? (data.verification_score !== undefined && data.verification_score !== null ? Number(data.verification_score) : undefined),
    verified: capture.verified ?? (data.method === 'FACE'),
  }
  return recordAttendance('CHECK_IN', id || '', data.device_info, requesterUser, mergedCapture)
}

export async function checkOut(
  targetOrData?: string | {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    event_id?: string
    eventId?: string
    verification_score?: number | null
  },
  secondArg?: string | { id?: string; role?: string },
  thirdArg?: { id?: string; role?: string },
  fourthArg?: CaptureOptions
) {
  const isObject = typeof targetOrData === 'object' && targetOrData !== null
  const targetEmployeeId = isObject ? (targetOrData.employeeId || targetOrData.employee_id) : targetOrData
  const isLegacy = typeof secondArg === 'string'
  const deviceInfo = isObject
    ? (targetOrData.device_info || (isLegacy ? secondArg : undefined))
    : (isLegacy ? secondArg : undefined)
  const requesterUser = isObject
    ? (typeof secondArg === 'object' ? secondArg : thirdArg)
    : (typeof secondArg === 'object' ? secondArg : thirdArg)
  const capture: CaptureOptions = (isObject ? (typeof secondArg === 'object' && !('id' in secondArg || 'role' in secondArg) ? (secondArg as CaptureOptions) : fourthArg) : fourthArg) || {}

  if (!targetEmployeeId && requesterUser?.role !== 'EMPLOYEE') throw AppError.badRequest('employeeId is required')
  const mergedCapture: CaptureOptions = {
    ...capture,
    eventId: capture.eventId || (isObject ? (targetOrData.eventId || targetOrData.event_id) : undefined),
    verificationScore: capture.verificationScore ?? (isObject && targetOrData.verification_score !== undefined && targetOrData.verification_score !== null ? Number(targetOrData.verification_score) : undefined),
    verified: capture.verified ?? (isObject && targetOrData.method === 'FACE'),
  }
  return recordAttendance('CHECK_OUT', targetEmployeeId || '', deviceInfo, requesterUser, mergedCapture)
}

export async function statistics(actor?: EmployeeActor) {
  const scope = await getEmployeeScope(actor)
  const start = startOfToday()
  const [checkedInToday, totalActiveEmployees] = await Promise.all([
    prisma.attendance_logs.groupBy({
      by: ['employee_id'],
      where: { employees: scope, type: 'CHECK_IN', event_time: { gte: start } },
    }),
    prisma.employee.count({ where: { AND: [scope, { status: 'ACTIVE' }] } }),
  ])

  const checkedIn = checkedInToday.length

  return {
    date: formatVNDateISO(start),
    checkedIn,
    totalEmployees: totalActiveEmployees,
    absent: Math.max(0, totalActiveEmployees - checkedIn),
  }
}

export async function getLocks(actor?: EmployeeActor) {
  const locks = await prisma.attendance_locks.findMany({
    orderBy: { work_date: 'desc' },
  })
  return locks.map((l) => ({
    date: formatVNDateISO(l.work_date),
    is_locked: l.is_locked,
    locked_at: l.locked_at,
    locked_by: actor?.role?.toUpperCase() === 'ADMIN' ? l.locked_by : undefined,
  }))
}

export async function toggleLock(dateStr: string, is_locked: boolean, actorUserId?: string, actorRole?: string) {
  if (actorRole?.toUpperCase() !== 'ADMIN') throw AppError.forbidden('Only Admin can lock or unlock global attendance dates')
  const work_date = new Date(`${dateStr}T00:00:00.000Z`)
  if (is_locked) await aggregateDailyAttendance(Number(dateStr.slice(5,7)), Number(dateStr.slice(0,4)), undefined, dateStr)
  const lock = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${dateStr.slice(0, 7)}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${dateStr}`}))`
    if (is_locked) {
      const days = await tx.daily_attendance_summary.findMany({ where: { work_date }, select: { calculation_details: true } })
      if (days.some(d => { const details = d.calculation_details as Record<string, unknown> | null; return details && !details.off && +new Date(String(details.scheduledEnd)) > Date.now() })) throw AppError.conflict('Ca chưa kết thúc, bao gồm ca qua đêm; chưa thể khóa ngày')
    }
    if (is_locked && await tx.attendanceAdjustment.count({ where: { work_date, status: 'PENDING' } })) throw AppError.conflict('Còn khoản OT/phạt chờ duyệt trước khi khóa ngày')
    if (is_locked && await tx.daily_attendance_summary.count({ where: { work_date, OR: [{ requires_review: true }, { overtime_status: 'PENDING' }, { policy_version: null }] } })) throw AppError.conflict('Cần rà soát công và duyệt OT trước khi khóa ngày')
    const lock = await tx.attendance_locks.upsert({ where: { work_date },
      update: { is_locked, locked_at: new Date(), locked_by: actorUserId || 'ADMIN' },
      create: { work_date, is_locked, locked_by: actorUserId || 'ADMIN' } })
    await tx.auditLog.create({ data: { userId: actorUserId, action: is_locked ? 'LOCK_ATTENDANCE_DATE' : 'UNLOCK_ATTENDANCE_DATE',
      target_table: 'attendance_locks', record_id: dateStr, new_values: { date: dateStr, is_locked } } })
    return lock
  })

  return {
    date: formatVNDateISO(lock.work_date),
    is_locked: lock.is_locked,
    locked_at: lock.locked_at,
    locked_by: lock.locked_by,
  }
}

/**
 * Tự động tổng hợp dữ liệu chấm công từ attendance_logs và employee_shifts
 * sang bảng daily_attendance_summary cho một tháng cụ thể (month: 1-12, year: e.g. 2026).
 * Đảm bảo luồng tính lương thông suốt: Sắp lịch -> Quẹt thẻ Checkin/out -> Tổng hợp ngày -> Tính lương cuối tháng.
 */
export async function aggregateDailyAttendance(month: number, year: number, employeeId?: string, onlyDate?: string, employeeScope: Prisma.EmployeeWhereInput = {}) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw AppError.badRequest('Tháng/năm không hợp lệ')
  return prisma.$transaction(async tx => {
    if (typeof (tx as any).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${year}-${String(month).padStart(2, '0')}`}))`
    }
    const start = onlyDate ? new Date(`${onlyDate}T00:00:00Z`) : new Date(Date.UTC(year, month - 1, 1))
    const end = onlyDate ? new Date(+start + MAX_PAIR_MS) : new Date(Date.UTC(year, month, 1))
    const first = `${year}-${String(month).padStart(2, '0')}-01`
    const today = vnDay(new Date())
    const employees = await tx.employee.findMany({ where: { AND: [employeeScope, employeeId ? buildIdOrCodeWhere(employeeId) : {
      OR: [{ status: 'ACTIVE' }, { attendance_logs: { some: { event_time: { gte: new Date(+start - MAX_PAIR_MS), lt: new Date(+end + MAX_PAIR_MS) } } } }],
    }] } })
    const ids = employees.map(e => e.id)
    if (!ids.length) return { month, year, totalSummaries: 0, details: [] }
    const [shifts, logs, summaries, locks, closedPayroll, adjustmentRows] = await Promise.all([
      tx.employee_shifts.findMany({ where: { employee_id: { in: ids }, work_date: { gte: new Date(+start - MAX_PAIR_MS), lt: new Date(+end + MAX_PAIR_MS) } }, include: { work_shifts: true } }),
      tx.attendance_logs.findMany({ where: { employee_id: { in: ids }, event_time: {
        gte: new Date(+new Date(`${onlyDate || first}T00:00:00+07:00`) - MAX_PAIR_MS),
        lt: new Date(+end + MAX_PAIR_MS),
      } }, orderBy: [{ event_time: 'asc' }, { id: 'asc' }] }),
      tx.daily_attendance_summary.findMany({ where: { employee_id: { in: ids }, work_date: { gte: start, lt: end } } }),
      tx.attendance_locks.findMany({ where: { work_date: { gte: start, lt: end }, is_locked: true } }),
      tx.payrollRecord.findMany({ where: { employeeId: { in: ids }, payroll_period: first.slice(0, 7), status: { in: ['FINALIZED', 'CONFIRMED', 'PAID'] } }, select: { employeeId: true } }),
      tx.attendanceAdjustment.findMany({ where: { employee_id: { in: ids }, work_date: { gte: start, lt: end } } }),
    ])
    const adjustmentBatch = { existing: new Map(adjustmentRows.map(r => [`${r.employee_id}:${r.work_date.toISOString().slice(0,10)}:${r.kind}`, r])), writes: [] as Prisma.AttendanceAdjustmentCreateManyInput[], audits: [] as Prisma.AuditLogCreateManyInput[] }
    const lockedDates = new Set(locks.map(l => vnDay(l.work_date)))
    const closedEmployees = new Set(closedPayroll.map(p => p.employeeId))
    const pendingWrites: Array<Record<string, unknown>> = []
    const invalidations: Prisma.AuditLogCreateManyInput[] = []
    const details: Array<Record<string, unknown>> = []
    const adjustmentPolicy = await tx.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
    let lastYield = performance.now()
    for (const emp of employees) {
      const empLogs = logs.filter(l => l.employee_id === emp.id)
      const empShifts = shifts.filter(s => s.employee_id === emp.id).map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
      const prepared = prepareAttendance(empLogs, empShifts)
      const pairing = prepared.pairing
      const pairedOuts = new Set(pairing.pairs.map(p => p.outId))
      const dates = new Set([
        ...shifts.filter(s => s.employee_id === emp.id).map(s => vnDay(s.work_date)),
        ...empLogs.filter(l => !pairedOuts.has(String(l.id))).map(l => prepared.workDate(l.event_time)),
        ...summaries.filter(s => s.employee_id === emp.id).map(s => vnDay(s.work_date)),
      ])
      for (const date of [...dates].sort()) {
        // Promise microtasks alone do not let HTTP handlers/timers run during CPU work.
        if (performance.now() - lastYield >= 10) {
          await yieldToRequests()
          lastYield = performance.now()
        }
        if (date.slice(0, 7) !== first.slice(0, 7) || date > today || (onlyDate && date !== onlyDate)) continue
        const assigned = empShifts.find(s => vnDay(s.work_date) === date)
        const calculation = calculateDay(date, empLogs, assigned || null, new Date(), empShifts, prepared)
        const workDate = new Date(`${date}T00:00:00Z`)
        const summary = (() => {
          const previous = summaries.find(s => s.employee_id === emp.id && vnDay(s.work_date) === date)
          if (lockedDates.has(date) || closedEmployees.has(emp.id)) return previous
          const previousDetails = previous?.calculation_details as Record<string, unknown> | null
          const changed = previousDetails?.fingerprint !== calculation.details.fingerprint || previous?.overtime_seconds !== calculation.overtimeSeconds || previousDetails?.policy !== calculation.details.policy
          const invalidatedReview = Boolean(previous?.manual_adjustment && changed)
          const approved = previous?.overtime_status === 'APPROVED' && !changed
          const manual = previous?.manual_adjustment && !changed
          const data = {
            shift_id: assigned?.shift_id ?? null, first_check_in: calculation.first, last_check_out: calculation.last,
            total_working_hours: calculation.workingHours,
            late_early: manual ? previous!.late_early : calculation.lateEarlyHours,
            overtime: approved ? previous!.overtime : 0,
            regular_seconds: Math.round(calculation.regularSeconds), overtime_seconds: Math.round(calculation.overtimeSeconds),
            late_early_seconds: Math.round(calculation.lateEarlySeconds), overtime_candidate_hours: manual ? Number(previous!.overtime_candidate_hours) : calculation.overtimeCandidateHours,
            overtime_status: approved ? 'APPROVED' : previous?.overtime_status === 'REJECTED' && !changed ? 'REJECTED' : (manual ? Number(previous!.overtime_candidate_hours) : calculation.overtimeCandidateHours) > 0 ? 'PENDING' : 'NONE',
            overtime_reason: changed ? null : previous?.overtime_reason,
            approved_by: changed ? null : previous?.approved_by, approved_at: changed ? null : previous?.approved_at,
            manual_adjustment: Boolean(manual), attendance_status: calculation.status,
            requires_review: manual ? previous!.requires_review : calculation.requiresReview || invalidatedReview,
            review_reason: manual ? previous!.review_reason : calculation.reviewReason || (invalidatedReview ? 'SOURCE_CHANGED_AFTER_REVIEW' : null),
            calculation_details: calculation.details, policy_version: calculation.details.policy,
          }
          if (changed && previous?.manual_adjustment) invalidations.push({ action: 'INVALIDATE_ATTENDANCE_REVIEW',
            target_table: 'daily_attendance_summary', record_id: String(previous.id),
            old_values: { overtime: Number(previous.overtime), late_early: Number(previous.late_early), reason: previous.overtime_reason },
            new_values: { reason: 'SOURCE_CHANGED', overtime: 0 } })
          if (changed || previousDetails?.details_version !== calculation.details.details_version || previous?.policy_version !== calculation.details.policy || previous?.attendance_status !== data.attendance_status || previous?.shift_id !== data.shift_id) {
            pendingWrites.push({ employee_id: emp.id, work_date: date, ...data, updated_at: new Date().toISOString() })
          }
          return data
        })()
        if (summary && !lockedDates.has(date) && !closedEmployees.has(emp.id)) {
          await syncDayAdjustments(tx, { ...summary, employee_id: emp.id, work_date: workDate }, Number(emp.hourly_rate || 0), Number(adjustmentPolicy?.absence_penalty_rate ?? 0.25), adjustmentBatch)
        }
        if (summary) details.push({ employee_code: emp.employee_code, employee_name: emp.full_name, date,
          total_working_hours: Number(summary.total_working_hours), overtime: Number(summary.overtime), overtime_status: summary.overtime_status,
          overtime_candidate_hours: Number(summary.overtime_candidate_hours), late_early: Number(summary.late_early), status: summary.attendance_status })
      }
    }
    if (process.env.NODE_ENV === 'test') for (const write of pendingWrites) {
      const { employee_id, work_date, updated_at, ...rest } = write as any
      await tx.daily_attendance_summary.upsert({
        where: { employee_id_work_date: { employee_id, work_date: new Date(`${work_date}T00:00:00Z`) } },
        create: { employee_id, work_date: new Date(`${work_date}T00:00:00Z`), ...rest },
        update: { ...rest, updated_at: new Date() },
      })
    }
    // One parametrized JSON batch avoids a DB round trip for every employee/day.
    if (typeof (tx as any).$executeRaw === 'function' && process.env.NODE_ENV !== 'test') {
      for (let offset = 0; offset < pendingWrites.length; offset += 250) {
        const columns = [
          ['employee_id','uuid'], ['work_date','date'], ['shift_id','integer'],
          ['first_check_in','timestamptz'], ['last_check_out','timestamptz'],
          ['total_working_hours','numeric'], ['late_early','numeric'], ['overtime','numeric'],
          ['regular_seconds','integer'], ['overtime_seconds','integer'], ['late_early_seconds','integer'],
          ['overtime_candidate_hours','numeric'], ['overtime_status','text'], ['overtime_reason','text'],
          ['approved_by','text'], ['approved_at','timestamptz'], ['manual_adjustment','boolean'],
          ['attendance_status','text'], ['requires_review','boolean'], ['review_reason','text'],
          ['calculation_details','jsonb'], ['policy_version','text'], ['updated_at','timestamptz'],
        ] as const
        // Identifiers and SQL types come exclusively from the static whitelist above.
        const names = Prisma.raw(columns.map(([name]) => `"${name}"`).join(', '))
        const definitions = Prisma.raw(columns.map(([name, type]) => `"${name}" ${type}`).join(', '))
        const updates = Prisma.raw(columns.filter(([name]) => name !== 'employee_id' && name !== 'work_date').map(([name]) => `"${name}" = EXCLUDED."${name}"`).join(', '))
        const payload = JSON.stringify(pendingWrites.slice(offset, offset + 250))
        await tx.$executeRaw`INSERT INTO daily_attendance_summary (${names})
          SELECT ${names} FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(${definitions})
          ON CONFLICT (employee_id, work_date) DO UPDATE SET ${updates}`
      }
    }
    await flushAdjustmentBatch(tx, adjustmentBatch)
    if (invalidations.length) await tx.auditLog.createMany({ data: invalidations })
    return { month, year, totalSummaries: details.length, details }
  }, { timeout: 60000 })
}

export interface ThingsBoardWebhookPayload {
  device_id?: string
  mode?: string
  antispoof_score?: number
  embedding?: number[]
  embedding_b64?: string
  event_id?: string
  event_kind?: string
  recognition_id?: string
  expected_employee_id?: string
  client_timestamp?: number | string
}

export async function handleThingsBoardWebhook(data: ThingsBoardWebhookPayload) {
  const { device_id, mode, antispoof_score } = data
  if (!device_id || !['CHECK_IN', 'CHECK_OUT'].includes(mode || '')) throw AppError.badRequest('device_id/mode không hợp lệ')
  if (typeof antispoof_score !== 'number' || !Number.isFinite(antispoof_score) || antispoof_score < 0 || antispoof_score > 1) throw AppError.badRequest('Cần điểm liveness hợp lệ')
  if (!data.event_id || !/^[a-zA-Z0-9_-]{8,120}$/.test(data.event_id)) throw AppError.badRequest('Cần event_id duy nhất cho lượt ghi nhận')
  const capturedAt = Number(data.client_timestamp)
  if (!Number.isFinite(capturedAt) || capturedAt <= 0) throw AppError.badRequest('client_timestamp không hợp lệ')

  // Anti-spoofing check
  if (typeof antispoof_score === 'number' && antispoof_score < 0.5) {
    if (typeof data.recognition_id === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(data.recognition_id)) {
      observeRecognition(device_id, `${mode}:${data.event_id}`, data.recognition_id, null)
    }
    emitAttendanceEvent('attendance-spoof-blocked', {
      device_id, event_id: data.event_id,
      antispoof_score,
      timestamp: new Date().toISOString(),
    })
    eventBus.publish('attendance:spoof-blocked', {
      device_id,
      similarity: antispoof_score,
      timestamp: new Date().toISOString(),
      status: 'BLOCKED_SPOOF',
    })
    return {
      success: false,
      matched: false,
      event_id: data.event_id,
      message: 'Khuôn mặt bị nghi ngờ giả mạo (Anti-spoofing rejected)',
      antispoof_score,
    }
  }

  const isConfirmation = ['VERIFY_ONLY', 'CONFIRMED_SCAN'].includes(data.event_kind || '')
  if (!isConfirmation) throw AppError.badRequest('Face attendance requires consecutive recognition confirmations; update edge client')
  if (data.event_kind && !isConfirmation) throw AppError.badRequest('Loại sự kiện không hợp lệ')
  if (isConfirmation && (typeof data.recognition_id !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(data.recognition_id))) {
    throw AppError.badRequest('Cần recognition_id duy nhất cho từng lượt nhận diện')
  }
  if (data.event_kind === 'CONFIRMED_SCAN' && (typeof data.expected_employee_id !== 'string' || !data.expected_employee_id.trim())) {
    throw AppError.badRequest('Cần expected_employee_id khi xác nhận điểm danh')
  }

  // Giải mã vector: Hỗ trợ cả Base64 Float32 (tối ưu ~2.7KB) và Array JSON truyền thống
  let vector: ArrayLike<number> | null = null

  if (typeof data.embedding_b64 === 'string' && data.embedding_b64.trim()) {
    try {
      const buf = Buffer.from(data.embedding_b64.trim(), 'base64')
      if (buf.length !== 512 * 4) {
        throw new Error(`Buffer size is ${buf.length} bytes, expected 2048 bytes (512 float32)`)
      }
      vector = new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT)
    } catch (err: any) {
      throw AppError.badRequest(`Invalid embedding_b64: ${err.message}`)
    }
  } else if (Array.isArray(data.embedding)) {
    vector = data.embedding
  }

  if (!vector || vector.length !== 512) {
    throw AppError.badRequest('Invalid embedding vector: must be an array or base64 of 512 float32 numbers')
  }

  // L2 Normalize vector
  let norm = 0
  for (let i = 0; i < vector.length; i++) {
    const val = vector[i]
    if (typeof val !== 'number' || !isFinite(val)) {
      throw AppError.badRequest('Embedding contains non-finite numbers')
    }
    norm += val * val
  }
  norm = Math.sqrt(norm)
  if (norm === 0) {
    throw AppError.badRequest('Embedding norm is zero')
  }
  const parts: string[] = []
  for (let i = 0; i < vector.length; i++) {
    parts.push((vector[i] / norm).toFixed(8))
  }
  const vecLiteral = '[' + parts.join(',') + ']'

  // Vector similarity search against active employees in DB
  const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.45
  const rows: Array<{
    emp_id: string
    employee_code: string
    full_name: string
    avatar_url: string | null
    embedding_type: string
    similarity: number
  }> = await prisma.$queryRaw`
    SELECT
      e.id AS emp_id,
      e.employee_code,
      e.full_name,
      e.avatar_url,
      f.embedding_type,
      (1 - (f.embedding <=> ${vecLiteral}::vector))::float AS similarity
    FROM face_embeddings f
    JOIN employees e ON e.id = f.employee_id
    WHERE f.is_active = true
      AND e.status = 'ACTIVE'
      AND f.embedding IS NOT NULL
    ORDER BY f.embedding <=> ${vecLiteral}::vector ASC
    LIMIT 1;
  `

  if (!rows || rows.length === 0 || rows[0].similarity < MATCH_THRESHOLD) {
    if (isConfirmation) observeRecognition(device_id, `${mode}:${data.event_id}`, data.recognition_id!, null)
    const bestSim = rows.length > 0 ? Number(rows[0].similarity.toFixed(4)) : 0
    emitAttendanceEvent('attendance-unknown', {
      device_id, event_id: data.event_id,
      similarity: bestSim,
      timestamp: new Date().toISOString(),
    })
    eventBus.publish('attendance:unknown', {
      device_id,
      similarity: bestSim,
      timestamp: new Date().toISOString(),
      status: 'UNKNOWN_FACE',
    })
    return {
      success: false,
      matched: false,
      similarity: bestSim,
      event_id: data.event_id,
      message: 'Không tìm thấy nhân viên phù hợp hoặc độ tương đồng quá thấp',
    }
  }

  const match = rows[0]
  const normalizedMode = (mode || 'CHECK_IN').toUpperCase()
  const isCheckOut = normalizedMode === 'CHECK_OUT'

  if (isConfirmation) {
    const confirmation = observeRecognition(device_id, `${mode}:${data.event_id}`, data.recognition_id!, match.emp_id)
    if (data.event_kind === 'VERIFY_ONLY' || !confirmation.ready || data.expected_employee_id !== match.emp_id) {
      return {
        success: true, matched: true, verification_only: true, event_id: data.event_id,
        mode: normalizedMode, recognition_id: data.recognition_id,
        confirmation_count: confirmation.count, confirmation_required: confirmation.required,
        employee: {id: match.emp_id, employee_code: match.employee_code, full_name: match.full_name, avatar_url: match.avatar_url},
        similarity: Number(match.similarity.toFixed(4)),
        message: `Xác minh ${normalizedMode} ${Math.min(confirmation.count, confirmation.required)}/${confirmation.required}; chưa ghi điểm danh`,
      }
    }
  }

  try {
    let attendanceRecord
    if (isCheckOut) {
      attendanceRecord = await checkOut(match.emp_id, `device:${device_id}`, undefined, { eventId: data.event_id, capturedAt, deviceId: device_id, verified: true, verificationScore: match.similarity, livenessScore: antispoof_score })
    } else {
      attendanceRecord = await checkIn({
        employeeId: match.emp_id,
        device_info: `device:${device_id}`,
        method: 'FACE',
      }, undefined, { eventId: data.event_id, capturedAt, deviceId: device_id, verified: true, verificationScore: match.similarity, livenessScore: antispoof_score })
    }

    // Emit Realtime Socket.IO Event for live web monitor
    if (!attendanceRecord.duplicate) emitAttendanceEvent(isCheckOut ? 'checked-out' : 'checked-in', attendanceRecord)

    return {
      success: true,
      matched: true,
      event_id: data.event_id,
      mode: normalizedMode,
      employee: {
        id: match.emp_id,
        employee_code: match.employee_code,
        full_name: match.full_name,
        avatar_url: match.avatar_url,
      },
      similarity: Number(match.similarity.toFixed(4)),
      attendance: attendanceRecord,
      message: `${isCheckOut ? 'Check-out' : 'Check-in'} thành công`,
    }
  } catch (err: any) {
    // Return structured response for 409 (already checked in / out today)
    return {
      success: false,
      matched: true,
      event_id: data.event_id,
      mode: normalizedMode,
      employee: {
        id: match.emp_id,
        employee_code: match.employee_code,
        full_name: match.full_name,
        avatar_url: match.avatar_url,
      },
      similarity: Number(match.similarity.toFixed(4)),
      code: err.statusCode || 400,
      message: err.message || 'Lỗi xử lý điểm danh',
    }
  }
}

/**
 * Public Module API: Lấy toàn bộ daily_attendance_summary theo danh sách nhân viên và khoảng thời gian (cho Payroll module)
 */
export async function getAttendanceSummariesByEmployeesAndDateRange(
  employeeIds: string[],
  startDate: Date,
  endDate: Date
) {
  return prisma.daily_attendance_summary.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { work_date: 'asc' },
  })
}

/**
 * Public Module API: Kiểm tra ngày làm việc có bị khóa công (attendance_locks) hay không
 */
export { isAttendanceDateLocked } from './attendance.lock.js'
