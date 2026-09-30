import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO } from '../../common/utils.js'
import { attendanceInclude } from './attendance.model.js'
import { logAction } from '../audit-logs/audit.service.js'
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

export function roundToHalfHour(seconds: number): number {
  if (seconds <= 0) return 0
  return Math.round(seconds / 1800) * 0.5
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
    attendance_id: `ATT-${log.id}`,
    employee_id: log.employees?.employee_code || log.employee_id,
    type: log.type as 'CHECK_IN' | 'CHECK_OUT',
    timestamp: eventDate.toISOString(),
    method: (log.method || ATTENDANCE_METHOD.FACE) as AttendanceMethod,
    device_id: log.device_info || (log.method === 'FINGERPRINT' ? 'Fingerprint-01' : 'FaceCam-01'),
    verification_score: log.verification_score ?? 0.98,
    status: (log.status || ATTENDANCE_LOG_STATUS.VALID) as AttendanceLogStatus,
    punctuality,
    raw_status: log.status,
  }
}

export async function list(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {}

  const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (empIdFilter) {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(empIdFilter),
    })
    where.employee_id = emp ? emp.id : empIdFilter
  }

  if (typeof query.date === 'string') {
    where.event_time = {
      gte: new Date(`${query.date}T00:00:00+07:00`),
      lt: new Date(`${query.date}T23:59:59.999+07:00`),
    }
  }

  if (typeof query.type === 'string') {
    where.type = query.type
  }

  // 19. Phân trang mặc định tối đa 1000 records/page để chống tràn bộ nhớ (OOM) khi có hàng triệu log
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 100))
  const skip = (page - 1) * limit

  const logs = await prisma.attendance_logs.findMany({
    where,
    include: attendanceInclude,
    orderBy: { event_time: 'desc' },
    skip,
    take: limit,
  })

  return logs.map(formatAttendanceRecord)
}

function calcShiftWorkingHours(startTimeVal?: string | Date | null, endTimeVal?: string | Date | null): number {
  const startTimeStr = extractTimeString(startTimeVal, '08:00')
  const endTimeStr = extractTimeString(endTimeVal, '17:30')
  const [sh, sm] = startTimeStr.split(':').map(Number)
  const [eh, em] = endTimeStr.split(':').map(Number)
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return 8
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const diffMins = Math.max(0, endMins - startMins)
  return Math.round((diffMins / 60) * 100) / 100
}

export async function getDailySummaries(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {}

  const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (empIdFilter) {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(empIdFilter),
    })
    where.employee_id = emp ? emp.id : empIdFilter
  }

  if (typeof query.date === 'string') {
    where.work_date = new Date(`${query.date}T00:00:00.000Z`)
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
    date: formatVNDateISO(s.work_date),
    total_working_hours: s.total_working_hours ? Number(s.total_working_hours) : 0,
    late_early: s.late_early ? Number(s.late_early) : 0,
    overtime: s.overtime ? Number(s.overtime) : 0,
    status: s.attendance_status,
  }))
}

export async function adjustAttendance(
  data: {
    employeeId: string
    date: string
    late_early: number
    overtime: number
  },
  actorUserId?: string
) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employeeId),
  })
  if (!emp) throw new AppError(404, 'Employee not found')

  const workDate = new Date(`${data.date}T00:00:00.000Z`)
  // Đơn vị chuẩn hóa toàn hệ thống: GIỜ (HOURS), làm tròn theo nấc 0.5 giờ (tương đương 30 phút)
  const roundedLateEarly = Math.round(Math.max(0, Number(data.late_early) || 0) * 2) / 2
  const roundedOvertime = Math.round(Math.max(0, Number(data.overtime) || 0) * 2) / 2

  const empShift = await prisma.employee_shifts.findFirst({
    where: { employee_id: emp.id, work_date: workDate },
  })
  const workingHours = calcShiftWorkingHours(empShift?.start_time || '08:00', empShift?.end_time || '17:30')

  const existingSummary = await prisma.daily_attendance_summary.findFirst({
    where: {
      employee_id: emp.id,
      work_date: workDate,
    },
  })

  let shiftId = existingSummary?.shift_id
  if (!shiftId) {
    const shift = await prisma.work_shifts.findFirst()
    shiftId = shift?.id ?? 1
  }

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
      updated_at: new Date(),
    },
    create: {
      employee_id: emp.id,
      work_date: workDate,
      shift_id: shiftId,
      total_working_hours: workingHours,
      late_early: roundedLateEarly,
      overtime: roundedOvertime,
      attendance_status: roundedLateEarly > 0 ? 'LATE' : 'PRESENT',
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
    },
  })

  return {
    id: summary.id.toString(),
    employee_id: emp.employee_code,
    date: data.date,
    total_working_hours: summary.total_working_hours ? Number(summary.total_working_hours) : workingHours,
    late_early: summary.late_early ? Number(summary.late_early) : 0,
    overtime: summary.overtime ? Number(summary.overtime) : 0,
    status: summary.attendance_status,
  }
}

export async function checkIn(data: { employeeId: string; device_info?: string; method?: AttendanceMethod }) {
  const employee = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employeeId),
  })
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
      method: data.method ?? 'FACE',
      device_info: data.device_info ?? 'FaceCam-01',
      verification_score: 0.99,
      status: 'VALID',
    },
    include: attendanceInclude,
  })

  return formatAttendanceRecord(created)
}

export async function checkOut(employeeId: string, device_info?: string) {
  const employee = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(employeeId),
  })
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
      method: 'FACE',
      device_info: device_info ?? 'FaceCam-01',
      verification_score: 0.99,
      status: 'VALID',
    },
    include: attendanceInclude,
  })

  return formatAttendanceRecord(created)
}

export async function statistics() {
  const start = startOfToday()
  const [checkedInToday, totalActiveEmployees] = await Promise.all([
    prisma.attendance_logs.groupBy({
      by: ['employee_id'],
      where: { type: 'CHECK_IN', event_time: { gte: start } },
    }),
    prisma.employee.count({ where: { status: 'ACTIVE' } }),
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

  // 1. Lọc danh sách nhân viên cần tổng hợp
  const targetEmployees = employeeId
    ? await prisma.employee.findMany({
        where: buildIdOrCodeWhere(employeeId),
        select: { id: true, employee_code: true, full_name: true },
      })
    : await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, employee_code: true, full_name: true },
      })

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

  // 2. Lấy toàn bộ ca làm việc (employee_shifts) trong tháng
  const empShifts = await prisma.employee_shifts.findMany({
    where: {
      employee_id: { in: empIds },
      work_date: { gte: periodStart, lt: periodEnd },
    },
    include: {
      work_shifts: true,
    },
    orderBy: { work_date: 'asc' },
  })

  // 3. Lấy toàn bộ lịch sử quẹt thẻ (attendance_logs) trong tháng
  const attLogs = await prisma.attendance_logs.findMany({
    where: {
      employee_id: { in: empIds },
      event_time: { gte: logStart, lt: logEnd },
      status: { not: 'INVALID' },
    },
    orderBy: { event_time: 'asc' },
  })

  // 4. Lấy ca làm việc mặc định dự phòng (nếu ngày đó nhân viên chưa được xếp ca mà vẫn quẹt thẻ)
  const defaultShift =
    (await prisma.work_shifts.findFirst({ where: { shift_name: 'Full time' } })) ||
    (await prisma.work_shifts.findFirst())

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

  // Lấy các audit log ADJUST_ATTENDANCE để biết bản ghi nào đã bị sửa tay
  const adjustedAuditLogs = await prisma.auditLog.findMany({
    where: {
      target_table: 'daily_attendance_summary',
      action: 'ADJUST_ATTENDANCE',
    },
    select: { record_id: true },
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
    const checkOutLogs = logs.filter((l) => l.type === 'CHECK_OUT' || l.type === 'TAN_CA')

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

    // Tính toán số giờ làm việc thực tế
    let workingHours = 0
    if (firstCheckIn && lastCheckOut && lastCheckOut.getTime() > firstCheckIn.getTime()) {
      const diffMs = lastCheckOut.getTime() - firstCheckIn.getTime()
      workingHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)))
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