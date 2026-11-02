import { attendanceWorkDate, shiftBounds } from './attendance.policy.js'
import { getEmployeeShiftsForDateRange } from '../shifts/public.js'
import { formatVNDateISO } from '../../common/utils.js'
import { ATTENDANCE_METHOD, ATTENDANCE_LOG_STATUS, ATTENDANCE_PUNCTUALITY, type AttendanceMethod, type AttendanceLogStatus, type AttendancePunctuality } from '../../common/constants.js'

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
  const workDate = attendanceWorkDate(eventDate, employeeShifts || [])
  const shift = employeeShifts?.find(s => formatVNDateISO(s.work_date) === workDate)
  if (!shift || shift.shift_type === 'OFF' || !shift.start_time || !shift.end_time) {
    return ATTENDANCE_PUNCTUALITY.UNRECORDED
  }
  const { start, end } = shiftBounds(workDate, shift)

  const GRACE_PERIOD_SECONDS = 15 * 60 // 15 phút ân hạn (grace period)

  if (type === 'CHECK_IN') {
    return +eventDate > +start + GRACE_PERIOD_SECONDS * 1000
      ? ATTENDANCE_PUNCTUALITY.LATE
      : ATTENDANCE_PUNCTUALITY.ON_TIME
  }

  if (type === 'CHECK_OUT') {
    return +eventDate < +end
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

export function formatAttendanceRecord(log: RawAttendanceLogDb, shifts = log.employees?.employee_shifts) {
  const eventDate = new Date(log.event_time)
  const punctuality = determinePunctuality(
    log.type,
    eventDate,
    shifts,
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

export async function formatAttendanceRecords(logs: RawAttendanceLogDb[]) {
  if (!logs.length) return []
  const dates = logs.map(log => formatVNDateISO(log.event_time)).sort()
  const employeeIds = [...new Set(logs.map(log => log.employee_id))]
  const shifts = await getEmployeeShiftsForDateRange(
    { gte: new Date(+new Date(`${dates[0]}T00:00:00Z`) - 86400000), lte: new Date(`${dates[dates.length - 1]}T00:00:00Z`) },
    employeeIds
  )
  const shiftsByEmployee = new Map<string, typeof shifts>()
  for (const shift of shifts) {
    const employeeShifts = shiftsByEmployee.get(shift.employee_id) || []
    employeeShifts.push(shift)
    shiftsByEmployee.set(shift.employee_id, employeeShifts)
  }
  return logs.map(log => formatAttendanceRecord(log, shiftsByEmployee.get(log.employee_id)?.map(shift => ({
    ...shift,
    start_time: shift.start_time ?? shift.work_shifts.start_time,
    end_time: shift.end_time ?? shift.work_shifts.end_time,
  }))))
}

