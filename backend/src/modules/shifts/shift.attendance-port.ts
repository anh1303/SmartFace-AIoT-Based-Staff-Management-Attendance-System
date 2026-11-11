type AttendancePort = Pick<typeof import('../attendance/public.js'), 'assertEditableDay' | 'aggregateDailyAttendance' | 'isAttendanceDateLocked' | 'invalidateDailySummaryForShiftChange'>

let attendance: AttendancePort | undefined

export function configureShiftAttendance(port: AttendancePort) { attendance = port }

export function shiftAttendance(): AttendancePort {
  if (!attendance) throw new Error('Shift attendance integration is not configured')
  return attendance
}
