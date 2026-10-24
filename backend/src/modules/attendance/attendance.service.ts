import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO, formatVNTime } from '../../common/utils.js'
import { eventBus } from '../../common/event-bus.js'
import { attendanceInclude } from './attendance.model.js'
import { isAttendanceDateLocked } from './attendance.lock.js'
import { logAction, findAuditLogs, findFirstAuditLog } from '../audit-logs/index.js'
import {
  findEmployeeByIdOrCode,
  findActiveEmployees,
  findEmployeeByUserId,
  countActiveEmployees,
} from '../employees/index.js'
import {
  getEmployeeShiftForDate,
  getEmployeeShiftsForDateRange,
  getDefaultShift,
  getEmployeeShiftsByDates,
  getEmployeeShiftsByFilter,
} from '../shifts/index.js'
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

export function determinePunctuality(
  type: string,
  eventTime: Date | string,
  employeeShifts?: Array<{ work_date: Date | string; start_time?: string | Date | null; end_time?: string | Date | null }> | null
): AttendancePunctuality {
  const eventDate = new Date(eventTime)
  const vnDateStr = eventDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

  // Tìm ca làm việc được phân công cho nhân viên vào ngày này
  const shift = employeeShifts?.find(s => {
    const shiftDateStr = formatVNDateISO(s.work_date)
    return shiftDateStr === vnDateStr
  })

  const shiftStartStr = extractTimeString(shift?.start_time, '08:00')
  const shiftEndStr = extractTimeString(shift?.end_time, '17:30')

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
    employee_code?: string
    avatar_url?: string | null
    user_id?: string | null
    employee_shifts?: Array<{ work_date: Date | string; start_time?: string | Date | null; end_time?: string | Date | null }> | null
  } | null
}

export interface FormattedAttendanceRecord {
  id: string
  attendance_id: string
  employee_id: string
  employee_uuid?: string
  employee_code?: string | null
  employee_name?: string | null
  avatar_url?: string | null
  type: 'CHECK_IN' | 'CHECK_OUT'
  timestamp: string
  event_time?: string
  method: AttendanceMethod
  device_id: string | null
  verification_score: number | null
  status: AttendanceLogStatus
  punctuality: AttendancePunctuality
  raw_status?: string | null
}

export function formatAttendanceRecord(log: RawAttendanceLogDb): FormattedAttendanceRecord {
  const eventDate = new Date(log.event_time)
  const punctuality = determinePunctuality(
    log.type,
    eventDate,
    log.employees?.employee_shifts,
  )

  return {
    id: log.id.toString(),
    attendance_id: `ATT-${log.id}`,
    employee_id: log.employees?.employee_code || log.employee_id,
    employee_uuid: log.employees?.id || log.employee_id,
    employee_code: log.employees?.employee_code || null,
    employee_name: log.employees?.full_name || null,
    avatar_url: log.employees?.avatar_url || null,
    type: log.type as 'CHECK_IN' | 'CHECK_OUT',
    timestamp: eventDate.toISOString(),
    event_time: eventDate.toISOString(),
    method: (log.method || ATTENDANCE_METHOD.FACE) as AttendanceMethod,
    device_id: log.device_info || null,
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
  const where: Record<string, unknown> = {}

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) return []
    where.employee_id = emp.id
  } else {
    const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
      ? query.employeeId
      : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

    if (empIdFilter) {
      const emp = await findEmployeeByIdOrCode(empIdFilter)
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

  // Phân trang & giới hạn số lượng bản ghi:
  // - Mặc định lấy 100 bản ghi nếu không truyền limit để tránh OOM/timeout
  // - Giới hạn tối đa 5,000 bản ghi/trang để bảo đảm an toàn bộ nhớ server
  const isGetAll = query.limit === 'all' || query.all === 'true' || query.all === true
  const page = Math.max(1, Number(query.page) || 1)
  const defaultLimit = 100
  const maxLimit = 5000
  const limit = isGetAll ? maxLimit : Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit))
  const skip = isGetAll ? 0 : (page - 1) * limit

  const logs = await prisma.attendance_logs.findMany({
    where,
    include: attendanceInclude,
    orderBy: { event_time: 'desc' },
    skip: skip > 0 ? skip : undefined,
    take: limit,
  })

  if (logs.length === 0) return []

  const empIds = [...new Set(logs.map(l => l.employee_id))]
  const dateStrings = [...new Set(logs.map(l => formatVNDateISO(l.event_time)))]

  const empShifts = await getEmployeeShiftsByDates(
    dateStrings.map(d => new Date(`${d}T00:00:00.000Z`)),
    empIds
  )

  const shiftMap = new Map<string, typeof empShifts[0]>()
  for (const s of empShifts) {
    shiftMap.set(`${s.employee_id}_${formatVNDateISO(s.work_date)}`, s)
  }

  return logs.map(l => {
    const shift = shiftMap.get(`${l.employee_id}_${formatVNDateISO(l.event_time)}`)
    return formatAttendanceRecord({
      ...l,
      employees: l.employees ? {
        ...l.employees,
        employee_shifts: shift ? [shift] : [],
      } : null,
    })
  })
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

export async function getDailySummaries(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = {}

  let empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) return []
    empIdFilter = emp.id
  }

  if (empIdFilter) {
    const emp = await findEmployeeByIdOrCode(empIdFilter)
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
      work_shifts: true,
    },
    orderBy: { work_date: 'asc' },
  })

  // Lấy logs và ca làm việc để bóc tách cặp thực tế và giây làm việc gốc
  const empIds = [...new Set(summaries.map(s => s.employee_id))]
  
  let logTimeWhere: { gte?: Date; lte?: Date } | undefined = undefined
  if (startDate && endDate) {
    logTimeWhere = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
      lte: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (startDate) {
    logTimeWhere = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
    }
  } else if (endDate) {
    logTimeWhere = {
      lte: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (singleDate) {
    logTimeWhere = {
      gte: new Date(`${singleDate}T00:00:00+07:00`),
      lte: new Date(`${singleDate}T23:59:59.999+07:00`),
    }
  }

  const logs = empIds.length > 0 ? await prisma.attendance_logs.findMany({
    where: {
      employee_id: { in: empIds },
      ...(logTimeWhere ? { event_time: logTimeWhere } : {}),
    },
    orderBy: { event_time: 'asc' },
  }) : []

  const logsMap = new Map<string, typeof logs>()
  for (const log of logs) {
    const dStr = formatVNDateISO(log.event_time)
    const key = `${log.employee_id}_${dStr}`
    const arr = logsMap.get(key) || []
    arr.push(log)
    logsMap.set(key, arr)
  }

  const empShifts = empIds.length > 0
    ? await getEmployeeShiftsByFilter({
        employeeIds: empIds,
        workDate: where.work_date as any,
      })
    : []
  const shiftMap = new Map(empShifts.map(es => [`${es.employee_id}_${formatVNDateISO(es.work_date)}`, es]))

  return summaries.map(s => {
    const dateStr = formatVNDateISO(s.work_date)
    const empKey = `${s.employee_id}_${dateStr}`
    const dayLogs = logsMap.get(empKey) || []
    const empShift = shiftMap.get(empKey)

    // Tạo các cặp thực tế IN -> OUT từ logs theo thứ tự thời gian
    const pairs: Array<{
      in_time: string | null
      out_time: string | null
      duration_seconds: number
      is_valid: boolean
      method: string
      device_info: string | null
      score: number | null
    }> = []

    let i = 0
    let totalRawWorkSec = 0
    while (i < dayLogs.length) {
      const cur = dayLogs[i]
      if (cur.type === 'CHECK_IN') {
        const next = dayLogs[i + 1]
        if (next && next.type === 'CHECK_OUT') {
          const duration = Math.max(0, Math.round((new Date(next.event_time).getTime() - new Date(cur.event_time).getTime()) / 1000))
          totalRawWorkSec += duration
          pairs.push({
            in_time: formatVNTime(cur.event_time),
            out_time: formatVNTime(next.event_time),
            duration_seconds: duration,
            is_valid: true,
            method: cur.method || 'FACE',
            device_info: cur.device_info || null,
            score: cur.verification_score ?? null,
          })
          i += 2
        } else {
          // Sự kiện lẻ CHECK_IN chưa có OUT
          pairs.push({
            in_time: formatVNTime(cur.event_time),
            out_time: null,
            duration_seconds: 0,
            is_valid: false,
            method: cur.method || 'FACE',
            device_info: cur.device_info || null,
            score: cur.verification_score ?? null,
          })
          i++
        }
      } else {
        // Sự kiện lẻ CHECK_OUT không có IN trước đó
        pairs.push({
          in_time: null,
          out_time: formatVNTime(cur.event_time),
          duration_seconds: 0,
          is_valid: false,
          method: cur.method || 'FACE',
          device_info: cur.device_info || null,
          score: cur.verification_score ?? null,
        })
        i++
      }
    }

    if (totalRawWorkSec === 0 && s.first_check_in && s.last_check_out) {
      totalRawWorkSec = Math.max(0, Math.round((new Date(s.last_check_out).getTime() - new Date(s.first_check_in).getTime()) / 1000))
    }

    const isOffDay = empShift?.shift_type === 'OFF'
    const regularHours = isOffDay ? 0 : (s.total_working_hours ? Number(s.total_working_hours) : 0)

    // Xác định phiên bản chính sách: đọc trực tiếp từ policy_version lưu trên bản ghi
    const policyVersion = s.policy_version ?? null

    const hasOrphanEvents = pairs.some(p => !p.is_valid)
    let needsReview = false
    let reviewReason: string | null = null

    if (policyVersion === null) {
      needsReview = true
      reviewReason = 'Dữ liệu cũ chưa có policy version'
    } else if (hasOrphanEvents) {
      needsReview = true
      reviewReason = 'Tồn tại sự kiện chấm công lẻ chưa ghép cặp'
    } else if (!s.first_check_in && dayLogs.length > 0) {
      needsReview = true
      reviewReason = 'Thiếu lượt điểm danh vào (Check-in)'
    } else if (!s.last_check_out && dayLogs.length > 0) {
      needsReview = true
      reviewReason = 'Thiếu lượt điểm danh ra (Check-out)'
    } else if (s.attendance_status === 'LATE_AND_EARLY') {
      needsReview = true
      reviewReason = 'Đi trễ và về sớm bất thường'
    } else if (isOffDay && (dayLogs.length > 0 || Number(s.overtime) > 0)) {
      needsReview = true
      reviewReason = 'Chấm công/tăng ca trong ngày nghỉ (OFF)'
    }

    const approvedOt = Number(s.overtime) || 0
    let proposedOt = approvedOt
    if (dayLogs.length > 0 && empShift?.end_time) {
      const shiftEndStr = extractTimeString(empShift.end_time, '17:30')
      const [eH, eM] = shiftEndStr.split(':').map(Number)
      const endSec = (eH || 17) * 3600 + (eM || 30) * 60
      const lastLog = dayLogs[dayLogs.length - 1]
      const lastOutSec = parseTimeToSecondsInVN(lastLog.event_time)
      if (lastOutSec !== null && lastOutSec > endSec) {
        proposedOt = roundToHalfHour(lastOutSec - endSec)
      }
    }
    const pendingOt = Math.max(0, proposedOt - approvedOt)

    return {
      id: s.id.toString(),
      employee_id: s.employees?.employee_code || s.employee_id,
      employee_uuid: s.employee_id,
      date: dateStr,
      regular_hours: regularHours,
      total_working_hours: regularHours,
      raw_work_seconds: totalRawWorkSec,
      late_early: s.late_early ? Number(s.late_early) : 0,
      overtime: approvedOt,
      approved_overtime_hours: approvedOt,
      proposed_overtime_hours: proposedOt,
      pending_overtime_hours: pendingOt,
      status: isOffDay && approvedOt > 0 ? 'OVERTIME' : s.attendance_status,
      first_check_in: s.first_check_in ? s.first_check_in.toISOString() : null,
      last_check_out: s.last_check_out ? s.last_check_out.toISOString() : null,
      needs_review: needsReview,
      review_reason: reviewReason,
      policy_version: policyVersion,
      is_legacy_no_policy: policyVersion === null,
      shift_name: empShift?.work_shifts?.shift_name || (isOffDay ? 'Nghỉ (OFF)' : (s.work_shifts?.shift_name || 'Chưa phân ca')),
      shift_type: empShift?.shift_type || (isOffDay ? 'OFF' : 'OFFICE_HOURS'),
      pairs,
      raw_events: dayLogs.map(l => ({
        id: l.id.toString(),
        time: formatVNTime(l.event_time),
        type: l.type as 'CHECK_IN' | 'CHECK_OUT',
        method: l.method,
        device_id: l.device_info,
        verification_score: l.verification_score,
        status: l.status,
      })),
    }
  })
}

/**
 * Tính toán tự động và cập nhật bảng daily_attendance_summary cho một nhân viên trong ngày chỉ định.
 * Tuân thủ chuẩn Modular Monolith / Feature-based Backend:
 * - Giờ làm việc trong ngày = thời gian kết thúc ca - thời gian bắt đầu ca (nếu có quẹt thẻ ít nhất 1 lần)
 * - Giờ đi trễ / về sớm = tổng thời gian trễ + sớm, làm tròn theo nấc 0.5 giờ:
 *   + 0 đến 29 phút -> +0 giờ
 *   + 30 đến 59 phút -> +0.5 giờ
 * - Giờ tăng ca (OT) = thời gian làm sau kết thúc ca, làm tròn tương tự:
 *   + 0 đến 29 phút -> +0 giờ
 *   + 30 đến 59 phút -> +0.5 giờ
 * - Bảo lưu các giá trị nếu bản ghi đã từng được Quản lý điều chỉnh thủ công (ADJUST_ATTENDANCE).
 */
export async function recalculateDailySummaryForEmployee(
  employeeId: string,
  workDateInput: Date | string
) {
  const dateStr = typeof workDateInput === 'string'
    ? workDateInput.slice(0, 10)
    : formatVNDateISO(workDateInput)
  const workDate = new Date(`${dateStr}T00:00:00.000Z`)

  const emp = await findEmployeeByIdOrCode(employeeId)
  if (!emp) return null

  // 1. Lấy ca làm việc của nhân viên trong ngày thông qua Shifts Module Service
  const empShift = await getEmployeeShiftForDate(emp.id, workDate)

  const defaultShift = await getDefaultShift()

  const shiftStartStr = extractTimeString(empShift?.start_time || empShift?.work_shifts?.start_time, '08:00')
  const shiftEndStr = extractTimeString(empShift?.end_time || empShift?.work_shifts?.end_time, '17:30')
  const [sH, sM] = shiftStartStr.split(':').map(Number)
  const [eH, eM] = shiftEndStr.split(':').map(Number)
  const startSec = (sH || 8) * 3600 + (sM || 0) * 60
  const endSec = (eH || 17) * 3600 + (eM || 30) * 60

  // 2. Lấy toàn bộ lượt quẹt thẻ của nhân viên trong ngày (theo múi giờ VN +07:00)
  const logStart = new Date(`${dateStr}T00:00:00+07:00`)
  const logEnd = new Date(`${dateStr}T23:59:59.999+07:00`)

  const logs = await prisma.attendance_logs.findMany({
    where: {
      employee_id: emp.id,
      event_time: { gte: logStart, lte: logEnd },
      status: { not: 'INVALID' },
    },
    orderBy: { event_time: 'asc' },
  })

  const checkInLogs = logs.filter((l) => l.type === 'CHECK_IN')
  const checkOutLogs = logs.filter((l) => l.type === 'CHECK_OUT')

  const firstCheckInLog = checkInLogs[0] || (logs.length > 0 ? logs[0] : null)
  const lastCheckOutLog =
    checkOutLogs[checkOutLogs.length - 1] ||
    (logs.length > 1 && logs[logs.length - 1].id !== firstCheckInLog?.id
      ? logs[logs.length - 1]
      : null)

  const firstCheckIn = firstCheckInLog ? new Date(firstCheckInLog.event_time) : null
  const lastCheckOut = lastCheckOutLog ? new Date(lastCheckOutLog.event_time) : null

  const inSec = parseTimeToSecondsInVN(firstCheckIn)
  const outSec = parseTimeToSecondsInVN(lastCheckOut)

  // 3. Tính workingHours: Chỉ tính full giờ công khi nhân viên hoàn tất cả lượt quẹt VÀO và RA (firstCheckIn && lastCheckOut).
  // Nếu chỉ quẹt 1 lượt (chỉ vào rồi bỏ về hoặc chỉ quẹt ra mà không quẹt vào), workingHours = 0 để tránh lỗ hổng chấm công.
  let workingHours = 0
  if (firstCheckIn && lastCheckOut) {
    workingHours = calcShiftWorkingHours(shiftStartStr, shiftEndStr)
  }

  // 4. Tính đi trễ và về sớm
  let lateSec = 0
  if (inSec !== null && inSec > startSec) {
    lateSec = inSec - startSec
  }
  let earlySec = 0
  if (outSec !== null && outSec < endSec) {
    earlySec = endSec - outSec
  }
  const rawLateEarly = lateSec + earlySec
  const lateEarlyHours = rawLateEarly > 0 ? roundToHalfHour(rawLateEarly) : 0

  // 5. Tính tăng ca (OT)
  let overtimeHours = 0
  if (outSec !== null && outSec > endSec) {
    const rawOTSec = outSec - endSec
    overtimeHours = roundToHalfHour(rawOTSec)
  }

  // 6. Tính trạng thái chuyên cần
  const GRACE_PERIOD_SEC = 15 * 60
  let status = 'PRESENT'
  if (!firstCheckIn && !lastCheckOut) {
    status = 'ABSENT'
  } else if (lateSec > GRACE_PERIOD_SEC && earlySec > 0) {
    status = 'LATE_AND_EARLY'
  } else if (lateSec > GRACE_PERIOD_SEC) {
    status = 'LATE'
  } else if (earlySec > 0) {
    status = 'EARLY_LEAVE'
  } else {
    status = 'PRESENT'
  }

  // 7. Bảo lưu điều chỉnh thủ công nếu quản lý đã từng sửa tay
  const existingSummary = await prisma.daily_attendance_summary.findFirst({
    where: {
      employee_id: emp.id,
      work_date: workDate,
    },
  })

  let wasManuallyAdjusted = Boolean(existingSummary?.manual_adjustment)
  if (!wasManuallyAdjusted && existingSummary) {
    const adjustedAuditLog = await findFirstAuditLog({
      target_table: 'daily_attendance_summary',
      record_id: String(existingSummary.id),
      action: 'ADJUST_ATTENDANCE',
    })
    wasManuallyAdjusted = Boolean(adjustedAuditLog)
  }

  const finalWorkingHours = wasManuallyAdjusted
    ? Number(existingSummary?.total_working_hours)
    : workingHours
  const finalLateEarly = wasManuallyAdjusted
    ? Number(existingSummary?.late_early)
    : lateEarlyHours
  const finalOvertime = wasManuallyAdjusted
    ? Number(existingSummary?.overtime)
    : overtimeHours
  const finalStatus = wasManuallyAdjusted
    ? (existingSummary?.attendance_status || status)
    : status

  const shiftId = empShift?.shift_id || empShift?.work_shifts?.id || defaultShift?.id || 1

  const summary = await prisma.daily_attendance_summary.upsert({
    where: {
      employee_id_work_date: {
        employee_id: emp.id,
        work_date: workDate,
      },
    },
    update: {
      shift_id: shiftId,
      first_check_in: firstCheckIn || existingSummary?.first_check_in,
      last_check_out: lastCheckOut || existingSummary?.last_check_out,
      total_working_hours: finalWorkingHours,
      late_early: finalLateEarly,
      overtime: finalOvertime,
      attendance_status: finalStatus,
      policy_version: 'v1.0',
      updated_at: new Date(),
    },
    create: {
      employee_id: emp.id,
      work_date: workDate,
      shift_id: shiftId,
      first_check_in: firstCheckIn,
      last_check_out: lastCheckOut,
      total_working_hours: finalWorkingHours,
      late_early: finalLateEarly,
      overtime: finalOvertime,
      attendance_status: finalStatus,
      policy_version: 'v1.0',
    },
  })

  return {
    id: summary.id.toString(),
    employee_id: emp.employee_code,
    employee_uuid: emp.id,
    date: dateStr,
    total_working_hours: finalWorkingHours,
    late_early: finalLateEarly,
    overtime: finalOvertime,
    status: finalStatus,
    first_check_in: firstCheckIn ? firstCheckIn.toISOString() : (existingSummary?.first_check_in ? existingSummary.first_check_in.toISOString() : null),
    last_check_out: lastCheckOut ? lastCheckOut.toISOString() : (existingSummary?.last_check_out ? existingSummary.last_check_out.toISOString() : null),
  }
}


export async function adjustAttendance(
  data: {
    employeeId: string
    date: string
    late_early: number
    overtime: number
    reason: string
  },
  actorUserId?: string,
  actorRole?: string
) {
  const emp = await findEmployeeByIdOrCode(data.employeeId)
  if (!emp) throw new AppError(404, 'Employee not found')

  const workDate = new Date(`${data.date}T00:00:00.000Z`)

  // 1. Kiểm tra ngày đã khóa công (Locked) chưa. Khi đã khóa, chỉ ADMIN mới được can thiệp
  const isLocked = await isAttendanceDateLocked(workDate)
  if (isLocked && actorRole?.toUpperCase() !== 'ADMIN') {
    throw AppError.forbidden(
      'Dữ liệu công ngày này đã bị khóa (Locked). Chỉ Quản trị viên (Admin) mới có quyền mở khóa để chỉnh sửa!'
    )
  }

  // 2. Chốt chặn phân quyền: Không ai được tự chỉnh sửa dữ liệu kiểm soát/xóa lỗi đi trễ của chính mình
  if (actorRole?.toUpperCase() !== 'ADMIN' && emp.user_id && emp.user_id === actorUserId) {
    throw AppError.forbidden(
      'Không ai được tự sửa dữ liệu kiểm soát của chính mình (chỉnh sửa công/xóa lỗi đi trễ). Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!'
    )
  }

  // 3. Manager không được chỉnh sửa dữ liệu công của Manager khác
  if (actorRole?.toUpperCase() === 'MANAGER') {
    const targetRole = emp.users?.roles?.role_name?.toUpperCase() || ''
    const posName = typeof (emp as any).position === 'string' ? (emp as any).position : (emp as any).position?.name || ''
    const posLevel = typeof (emp as any).position === 'object' ? (emp as any).position?.level : undefined
    const isTargetManager = Boolean(
      targetRole === 'MANAGER' ||
      targetRole === 'ADMIN' ||
      posLevel === 'MANAGER' ||
      (posName && /quản lý|manager|trưởng phòng|giám đốc/i.test(posName)) ||
      (emp.department?.name && /quản lý/i.test(emp.department.name))
    )
    if (isTargetManager && emp.user_id !== actorUserId) {
      throw AppError.forbidden('Quản lý không có quyền chỉnh sửa dữ liệu chấm công của quản lý khác!')
    }
  }

  // Đơn vị chuẩn hóa toàn hệ thống: GIỜ (HOURS), làm tròn theo nấc 0.5 giờ:
  // - Từ 0 đến 29 phút: quy về phần giờ + 0 giờ
  // - Từ 30 đến 59 phút: quy về phần giờ + 0.5 giờ
  const roundHours = (val: number): number => {
    const totalMinutes = Math.round(Math.max(0, val) * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours + (minutes >= 30 ? 0.5 : 0)
  }
  const roundedLateEarly = roundHours(Number(data.late_early) || 0)
  const roundedOvertime = roundHours(Number(data.overtime) || 0)

  const empShift = await getEmployeeShiftForDate(emp.id, workDate)
  const isOffDay = empShift?.shift_type === 'OFF'
  // Nếu là ngày nghỉ OFF hoặc chưa phân ca, giờ công chuẩn = 0
  const workingHours = isOffDay || !empShift
    ? 0
    : calcShiftWorkingHours(empShift?.start_time || '08:30', empShift?.end_time || '17:30')

  const existingSummary = await prisma.daily_attendance_summary.findFirst({
    where: {
      employee_id: emp.id,
      work_date: workDate,
    },
  })

  let shiftId = existingSummary?.shift_id || empShift?.shift_id
  if (!shiftId) {
    const shift = await getDefaultShift()
    shiftId = shift?.id ?? 1
  }

  const determinedStatus = isOffDay
    ? (roundedOvertime > 0 ? 'OVERTIME' : 'OFF')
    : (roundedLateEarly > 0 ? 'LATE' : 'PRESENT')

  const summary = await prisma.daily_attendance_summary.upsert({
    where: {
      employee_id_work_date: {
        employee_id: emp.id,
        work_date: workDate,
      },
    },
    update: {
      total_working_hours: workingHours,
      late_early: roundedLateEarly,
      overtime: roundedOvertime,
      attendance_status: determinedStatus,
      manual_adjustment: true,
      policy_version: 'v1.0',
      updated_at: new Date(),
    },
    create: {
      employee_id: emp.id,
      work_date: workDate,
      shift_id: shiftId,
      total_working_hours: workingHours,
      late_early: roundedLateEarly,
      overtime: roundedOvertime,
      attendance_status: determinedStatus,
      manual_adjustment: true,
      policy_version: 'v1.0',
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'ADJUST_ATTENDANCE',
    target_table: 'daily_attendance_summary',
    record_id: String(summary.id),
    old_values: existingSummary ? {
      total_working_hours: existingSummary.total_working_hours ? Number(existingSummary.total_working_hours) : null,
      late_early: existingSummary.late_early ? Number(existingSummary.late_early) : null,
      overtime: existingSummary.overtime ? Number(existingSummary.overtime) : null,
      status: existingSummary.attendance_status,
    } : undefined,
    new_values: {
      employee_id: emp.id,
      employee_code: emp.employee_code,
      work_date: data.date,
      total_working_hours: workingHours,
      late_early: roundedLateEarly,
      overtime: roundedOvertime,
      status: summary.attendance_status,
      reason: data.reason,
    },
  })

  const summaryResult = {
    id: summary.id.toString(),
    employee_id: emp.employee_code,
    employee_uuid: emp.id,
    date: data.date,
    total_working_hours: summary.total_working_hours ? Number(summary.total_working_hours) : workingHours,
    late_early: summary.late_early ? Number(summary.late_early) : 0,
    overtime: summary.overtime ? Number(summary.overtime) : 0,
    status: summary.attendance_status,
    reason: data.reason,
  }

  eventBus.publish('attendance:summary-updated', {
    employeeId: emp.id,
    workDate: data.date,
    summary: summaryResult,
  })

  return summaryResult
}

export interface AttendanceResultWithSummary extends ReturnType<typeof formatAttendanceRecord> {
  summary?: {
    id: string
    employee_id: string
    employee_uuid: string
    date: string
    total_working_hours: number
    late_early: number
    overtime: number
    status: string
    first_check_in: string | null
    last_check_out: string | null
  } | null
}

export async function checkIn(
  data: {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    verification_score?: number | null
  },
  requesterUser?: { id?: string; role?: string }
): Promise<AttendanceResultWithSummary> {
  let targetEmployeeId = data.employeeId || data.employee_id;
  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) throw new AppError(404, 'Không tìm thấy hồ sơ nhân viên tương ứng với tài khoản này');
    targetEmployeeId = emp.id;
  }
  if (!targetEmployeeId) throw new AppError(400, 'employeeId is required');

  const employee = await findEmployeeByIdOrCode(targetEmployeeId)
  if (!employee) throw new AppError(404, 'Employee not found')

  const todayCheckIn = await prisma.attendance_logs.findFirst({
    where: {
      employee_id: employee.id,
      type: 'CHECK_IN',
      event_time: { gte: startOfToday() },
    },
    orderBy: { event_time: 'desc' },
  })

  if (todayCheckIn) {
    const subsequentCheckOut = await prisma.attendance_logs.findFirst({
      where: {
        employee_id: employee.id,
        type: 'CHECK_OUT',
        event_time: { gt: todayCheckIn.event_time },
      },
    })
    if (!subsequentCheckOut) throw new AppError(409, 'Employee is already checked in today')
  }

  const created = await prisma.attendance_logs.create({
    data: {
      employee_id: employee.id,
      type: 'CHECK_IN',
      method: data.method ?? ATTENDANCE_METHOD.FACE,
      device_info: data.device_info ?? 'FaceCam-01',
      verification_score: data.verification_score !== undefined ? data.verification_score : (data.method === 'MANUAL' ? null : 0.99),
      status: 'VALID',
    },
    include: attendanceInclude,
  })

  // Backend tính toán tự động giờ làm, trễ sớm, tăng ca và cập nhật daily_attendance_summary ngay lập tức
  const summary = await recalculateDailySummaryForEmployee(employee.id, created.event_time)

  const workDateObj = new Date(`${formatVNDateISO(created.event_time)}T00:00:00.000Z`)
  const todayShift = await getEmployeeShiftForDate(employee.id, workDateObj)

  const result: AttendanceResultWithSummary = {
    ...formatAttendanceRecord({
      ...created,
      employees: created.employees ? {
        ...created.employees,
        employee_shifts: todayShift ? [todayShift] : [],
      } : null,
    }),
    summary,
  }

  // Bắn domain event qua EventBus (Gateway tự động subscribe để phát Socket.IO)
  eventBus.publish('attendance:checked-in', {
    employeeId: employee.id,
    logId: String(created.id),
    eventTime: created.event_time,
    type: 'CHECK_IN',
    method: created.method,
    deviceInfo: created.device_info,
    payload: result,
  })

  return result
}

export async function checkOut(
  targetOrData?: string | {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    verification_score?: number | null
  },
  secondArg?: string | { id?: string; role?: string },
  thirdArg?: { id?: string; role?: string },
  method_param?: AttendanceMethod,
  verification_score_param?: number | null
): Promise<AttendanceResultWithSummary> {
  const isObject = typeof targetOrData === 'object' && targetOrData !== null
  const targetEmployeeId = isObject ? (targetOrData.employeeId || targetOrData.employee_id) : targetOrData

  // Nhận diện linh hoạt:
  // - Nếu secondArg là string: legacy/internal call dạng checkOut(empId, deviceInfo, requesterUser)
  // - Nếu secondArg là object: call chuẩn dạng checkOut(body, requesterUser) hoặc checkOut(empId, requesterUser)
  const isLegacy = typeof secondArg === 'string'
  const deviceInfo = isObject
    ? (targetOrData.device_info || (isLegacy ? secondArg : undefined))
    : (isLegacy ? secondArg : undefined)
  const requesterUser = isObject
    ? (typeof secondArg === 'object' ? secondArg : thirdArg)
    : (isLegacy ? thirdArg : (typeof secondArg === 'object' ? secondArg : undefined))
  const method = isObject ? (targetOrData.method || method_param) : method_param
  const verificationScore = isObject
    ? (targetOrData.verification_score !== undefined ? targetOrData.verification_score : verification_score_param)
    : verification_score_param

  let resolvedEmpId = targetEmployeeId
  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) throw new AppError(404, 'Không tìm thấy hồ sơ nhân viên tương ứng với tài khoản này')
    resolvedEmpId = emp.id
  }
  if (!resolvedEmpId) throw new AppError(400, 'employeeId is required')

  const employee = await findEmployeeByIdOrCode(resolvedEmpId)
  if (!employee) throw new AppError(404, 'Employee not found')

  const lastCheckIn = await prisma.attendance_logs.findFirst({
    where: {
      employee_id: employee.id,
      type: 'CHECK_IN',
      event_time: { gte: startOfToday() },
    },
    orderBy: { event_time: 'desc' },
  })

  if (!lastCheckIn) throw new AppError(404, 'No active check-in found for today')

  const subsequentCheckOut = await prisma.attendance_logs.findFirst({
    where: {
      employee_id: employee.id,
      type: 'CHECK_OUT',
      event_time: { gt: lastCheckIn.event_time },
    },
  })

  if (subsequentCheckOut) throw new AppError(409, 'Employee already checked out')

  const created = await prisma.attendance_logs.create({
    data: {
      employee_id: employee.id,
      type: 'CHECK_OUT',
      method: method ?? ATTENDANCE_METHOD.FACE,
      device_info: deviceInfo ?? 'FaceCam-01',
      verification_score: verificationScore !== undefined ? verificationScore : (method === 'MANUAL' ? null : 0.99),
      status: 'VALID',
    },
    include: attendanceInclude,
  })

  // Backend tính toán tự động giờ làm, trễ sớm, tăng ca và cập nhật daily_attendance_summary ngay lập tức
  const summary = await recalculateDailySummaryForEmployee(employee.id, created.event_time)

  const workDateObj = new Date(`${formatVNDateISO(created.event_time)}T00:00:00.000Z`)
  const todayShift = await getEmployeeShiftForDate(employee.id, workDateObj)

  const result: AttendanceResultWithSummary = {
    ...formatAttendanceRecord({
      ...created,
      employees: created.employees ? {
        ...created.employees,
        employee_shifts: todayShift ? [todayShift] : [],
      } : null,
    }),
    summary,
  }

  // Bắn domain event qua EventBus (Gateway tự động subscribe để phát Socket.IO)
  eventBus.publish('attendance:checked-out', {
    employeeId: employee.id,
    logId: String(created.id),
    eventTime: created.event_time,
    type: 'CHECK_OUT',
    method: created.method,
    deviceInfo: created.device_info,
    payload: result,
  })

  return result
}

export async function statistics() {
  const start = startOfToday()
  const [checkedInToday, totalActiveEmployees] = await Promise.all([
    prisma.attendance_logs.groupBy({
      by: ['employee_id'],
      where: { type: 'CHECK_IN', event_time: { gte: start } },
    }),
    countActiveEmployees(),
  ])

  const checkedIn = checkedInToday.length

  return {
    date: formatVNDateISO(start),
    checkedIn,
    totalEmployees: totalActiveEmployees,
    absent: Math.max(0, totalActiveEmployees - checkedIn),
  }
}

export async function getLocks() {
  const locks = await prisma.attendance_locks.findMany({
    orderBy: { work_date: 'desc' },
  })
  return locks.map((l) => ({
    date: formatVNDateISO(l.work_date),
    is_locked: l.is_locked,
    locked_at: l.locked_at,
    locked_by: l.locked_by,
  }))
}

export async function toggleLock(dateStr: string, is_locked: boolean, actorUserId?: string) {
  const work_date = new Date(`${dateStr}T00:00:00.000Z`)
  const lock = await prisma.attendance_locks.upsert({
    where: { work_date },
    update: { is_locked, locked_at: new Date(), locked_by: actorUserId || 'MANAGER' },
    create: { work_date, is_locked, locked_by: actorUserId || 'MANAGER' },
  })

  await logAction({
    userId: actorUserId,
    action: is_locked ? 'LOCK_ATTENDANCE_DATE' : 'UNLOCK_ATTENDANCE_DATE',
    target_table: 'attendance_locks',
    record_id: dateStr,
    new_values: { date: dateStr, is_locked },
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
export async function aggregateDailyAttendance(
  month: number,
  year: number,
  employeeId?: string
) {
  const monthStr = String(month).padStart(2, '0')
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthStr = String(nextMonth).padStart(2, '0')

  // Mốc thời gian UTC dùng cho work_date (@db.Date)
  const periodStart = new Date(`${year}-${monthStr}-01T00:00:00.000Z`)
  const periodEnd = new Date(`${nextYear}-${nextMonthStr}-01T00:00:00.000Z`)

  // Mốc thời gian theo múi giờ Việt Nam (+07:00) cho attendance_logs (Timestamptz)
  const logStart = new Date(`${year}-${monthStr}-01T00:00:00+07:00`)
  const logEnd = new Date(`${nextYear}-${nextMonthStr}-01T00:00:00+07:00`)

  // 1. Lọc danh sách nhân viên cần tổng hợp thông qua Employees Module
  const singleEmp = employeeId ? await findEmployeeByIdOrCode(employeeId) : null
  const targetEmployees = singleEmp
    ? [singleEmp]
    : await findActiveEmployees()

  if (targetEmployees.length === 0) {
    return {
      month,
      year,
      totalSummaries: 0,
      details: [],
    }
  }

  const empIds = targetEmployees.map((e) => e.id)
  const empMap = new Map(targetEmployees.map((e) => [e.id, e]))

  // 2. Lấy toàn bộ ca làm việc trong tháng thông qua Shifts Module Service
  const empShifts = await getEmployeeShiftsForDateRange(
    { gte: periodStart, lte: periodEnd },
    empIds
  )

  // 3. Lấy toàn bộ lịch sử quẹt thẻ (attendance_logs) trong tháng
  const attLogs = await prisma.attendance_logs.findMany({
    where: {
      employee_id: { in: empIds },
      event_time: { gte: logStart, lt: logEnd },
      status: { not: 'INVALID' },
    },
    orderBy: { event_time: 'asc' },
  })

  // 4. Lấy ca làm việc mặc định dự phòng qua shifts module API
  const defaultShift = await getDefaultShift()

  // 5. Gom nhóm theo cặp (employee_id, dateStr)
  interface DayGroup {
    employee_id: string
    dateStr: string
    shift: (typeof empShifts)[0] | null
    logs: typeof attLogs
  }
  const dayGroups = new Map<string, DayGroup>()

  for (const s of empShifts) {
    const dateStr = formatVNDateISO(s.work_date)
    const key = `${s.employee_id}_${dateStr}`
    dayGroups.set(key, {
      employee_id: s.employee_id,
      dateStr,
      shift: s,
      logs: [],
    })
  }

  for (const log of attLogs) {
    const dateStr = formatVNDateISO(log.event_time)
    const key = `${log.employee_id}_${dateStr}`
    const existing = dayGroups.get(key)
    if (existing) {
      existing.logs.push(log)
    } else {
      dayGroups.set(key, {
        employee_id: log.employee_id,
        dateStr,
        shift: null,
        logs: [log],
      })
    }
  }

  // 6. Kiểm tra các bản ghi đã được Quản lý chỉnh sửa thủ công để bảo vệ (preserve manual adjustments)
  const existingSummaries = await prisma.daily_attendance_summary.findMany({
    where: {
      employee_id: { in: empIds },
      work_date: { gte: periodStart, lt: periodEnd },
    },
  })
  const existingSummaryMap = new Map(
    existingSummaries.map((s) => [`${s.employee_id}_${formatVNDateISO(s.work_date)}`, s])
  )

  // Lấy các audit log ADJUST_ATTENDANCE qua audit-logs module API
  const adjustedAuditLogs = await findAuditLogs({
    target_table: 'daily_attendance_summary',
    action: 'ADJUST_ATTENDANCE',
  })
  const adjustedRecordIds = new Set(adjustedAuditLogs.map((a) => a.record_id))

  let summaryCount = 0
  const details: Array<{
    employee_code: string
    employee_name: string
    date: string
    total_working_hours: number
    late_early: number
    overtime: number
    status: string
  }> = []

  // 7. Xử lý tính toán từng ngày
  for (const group of dayGroups.values()) {
    const { employee_id, dateStr, shift, logs } = group
    const workDate = new Date(`${dateStr}T00:00:00.000Z`)
    const summaryKey = `${employee_id}_${dateStr}`
    const existingSummary = existingSummaryMap.get(summaryKey)

    // Nếu bản ghi này đã được quản lý can thiệp chỉnh sửa thủ công, bảo lưu giá trị chỉnh sửa
    const wasManuallyAdjusted = existingSummary && adjustedRecordIds.has(String(existingSummary.id))

    // Giờ bắt đầu và kết thúc ca chuẩn
    const shiftStartStr = extractTimeString(shift?.start_time || shift?.work_shifts?.start_time, '08:00')
    const shiftEndStr = extractTimeString(shift?.end_time || shift?.work_shifts?.end_time, '18:00')
    const [sH, sM] = shiftStartStr.split(':').map(Number)
    const [eH, eM] = shiftEndStr.split(':').map(Number)
    const startSec = (sH || 8) * 3600 + (sM || 0) * 60
    const endSec = (eH || 18) * 3600 + (eM || 0) * 60

    // Phân loại các lượt quẹt thẻ trong ngày
    logs.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
    const checkInLogs = logs.filter((l) => l.type === 'CHECK_IN')
    const checkOutLogs = logs.filter((l) => l.type === 'CHECK_OUT')

    const firstCheckInLog = checkInLogs[0] || (logs.length > 0 ? logs[0] : null)
    const lastCheckOutLog =
      checkOutLogs[checkOutLogs.length - 1] ||
      (logs.length > 1 && logs[logs.length - 1].id !== firstCheckInLog?.id
        ? logs[logs.length - 1]
        : null)

    const firstCheckIn = firstCheckInLog ? new Date(firstCheckInLog.event_time) : null
    const lastCheckOut = lastCheckOutLog ? new Date(lastCheckOutLog.event_time) : null

    const inSec = parseTimeToSecondsInVN(firstCheckIn)
    const outSec = parseTimeToSecondsInVN(lastCheckOut)

    // Tính toán số giờ làm việc trong ngày:
    // Cần hoàn tất cả lượt quẹt VÀO và RA (firstCheckIn && lastCheckOut) mới tính đủ giờ công của ca làm việc.
    // Nếu chỉ có 1 lượt quẹt, workingHours = 0 (cần Quản lý điều chỉnh thủ công nếu do sự cố camera/quên quẹt thẻ).
    let workingHours = 0
    if (firstCheckIn && lastCheckOut) {
      workingHours = calcShiftWorkingHours(shiftStartStr, shiftEndStr)
    }

    // Tính toán đi trễ và về sớm (làm tròn nấc 0.5 giờ)
    let lateSec = 0
    if (inSec !== null && inSec > startSec) {
      lateSec = inSec - startSec
    }
    let earlySec = 0
    if (outSec !== null && outSec < endSec) {
      earlySec = endSec - outSec
    }
    const rawLateEarly = lateSec + earlySec
    const lateEarlyHours = rawLateEarly > 0 ? roundToHalfHour(rawLateEarly) : 0

    // Tính toán giờ tăng ca (OT): thời gian làm SAU giờ kết thúc ca
    let overtimeHours = 0
    if (outSec !== null && outSec > endSec) {
      const rawOTSec = outSec - endSec
      overtimeHours = roundToHalfHour(rawOTSec)
    }

    // Xác định trạng thái chuyên cần
    const GRACE_PERIOD_SEC = 15 * 60 // 15 phút ân hạn
    let status = 'PRESENT'
    if (!firstCheckIn && !lastCheckOut) {
      status = 'ABSENT'
    } else if (lateSec > GRACE_PERIOD_SEC && earlySec > 0) {
      status = 'LATE_AND_EARLY'
    } else if (lateSec > GRACE_PERIOD_SEC) {
      status = 'LATE'
    } else if (earlySec > 0) {
      status = 'EARLY_LEAVE'
    } else {
      status = 'PRESENT'
    }

    // Nếu đã được Quản lý chỉnh sửa thủ công trước đó thì giữ nguyên các con số giờ
    const finalWorkingHours = wasManuallyAdjusted
      ? Number(existingSummary.total_working_hours)
      : workingHours
    const finalLateEarly = wasManuallyAdjusted
      ? Number(existingSummary.late_early)
      : lateEarlyHours
    const finalOvertime = wasManuallyAdjusted
      ? Number(existingSummary.overtime)
      : overtimeHours
    const finalStatus = wasManuallyAdjusted
      ? existingSummary.attendance_status
      : status

    const shiftId = shift?.shift_id || shift?.work_shifts?.id || defaultShift?.id || 1

    await prisma.daily_attendance_summary.upsert({
      where: {
        employee_id_work_date: {
          employee_id,
          work_date: workDate,
        },
      },
      update: {
        shift_id: shiftId,
        first_check_in: firstCheckIn || existingSummary?.first_check_in,
        last_check_out: lastCheckOut || existingSummary?.last_check_out,
        total_working_hours: finalWorkingHours,
        late_early: finalLateEarly,
        overtime: finalOvertime,
        attendance_status: finalStatus,
        policy_version: 'v1.0',
        updated_at: new Date(),
      },
      create: {
        employee_id,
        work_date: workDate,
        shift_id: shiftId,
        first_check_in: firstCheckIn,
        last_check_out: lastCheckOut,
        total_working_hours: finalWorkingHours,
        late_early: finalLateEarly,
        overtime: finalOvertime,
        attendance_status: finalStatus,
        policy_version: 'v1.0',
      },
    })

    summaryCount++
    const empInfo = empMap.get(employee_id)
    details.push({
      employee_code: empInfo?.employee_code || '',
      employee_name: empInfo?.full_name || '',
      date: dateStr,
      total_working_hours: finalWorkingHours,
      late_early: finalLateEarly,
      overtime: finalOvertime,
      status: finalStatus,
    })
  }

  return {
    month,
    year,
    totalSummaries: summaryCount,
    details,
  }
}

export interface ThingsBoardWebhookPayload {
  device_id?: string
  mode?: string
  antispoof_score?: number
  embedding?: number[]
  embedding_b64?: string
  client_timestamp?: number | string
}

export async function handleThingsBoardWebhook(data: ThingsBoardWebhookPayload) {
  const { device_id = 'PI4_FRONT_GATE', mode = 'CHECK_IN', antispoof_score = 1.0 } = data

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

  // Anti-spoofing check
  if (typeof antispoof_score === 'number' && antispoof_score < 0.5) {
    eventBus.publish('attendance:spoof-blocked', {
      device_id,
      similarity: antispoof_score,
      timestamp: new Date().toISOString(),
      status: 'BLOCKED_SPOOF',
    })
    return {
      success: false,
      matched: false,
      message: 'Khuôn mặt bị nghi ngờ giả mạo (Anti-spoofing rejected)',
      antispoof_score,
    }
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
  const MATCH_THRESHOLD = env.FACE_MATCH_THRESHOLD
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
    const bestSim = rows.length > 0 ? Number(rows[0].similarity.toFixed(4)) : 0
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
      message: 'Không tìm thấy nhân viên phù hợp hoặc độ tương đồng quá thấp',
    }
  }

  const match = rows[0]
  const normalizedMode = (mode || 'CHECK_IN').toUpperCase()
  const isCheckOut = normalizedMode === 'CHECK_OUT'

  try {
    let attendanceRecord
    if (isCheckOut) {
      attendanceRecord = await checkOut(match.emp_id, `device:${device_id}`)
    } else {
      attendanceRecord = await checkIn({
        employeeId: match.emp_id,
        device_info: `device:${device_id}`,
        method: 'FACE',
      })
    }

    // CheckIn/CheckOut đã tự động publish domain event lên eventBus, không cần emit thủ công lặp lại
    return {
      success: true,
      matched: true,
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
