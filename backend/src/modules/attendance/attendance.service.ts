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

  const extractTimeString = (val?: string | Date | null, fallback: string = '08:00'): string => {
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
  const extractTimeString = (val?: string | Date | null, fallback: string = '08:00'): string => {
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