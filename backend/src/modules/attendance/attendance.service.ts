import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import {
  ATTENDANCE_TYPE,
  ATTENDANCE_METHOD,
  ATTENDANCE_LOG_STATUS,
  DAILY_ATTENDANCE_STATUS,
  EMPLOYEE_STATUS,
  type AttendanceType,
  type AttendanceMethod,
} from '../../common/constants.js'
import { attendanceInclude } from './attendance.model.js'

const startOfToday = () => {
  const now = new Date()
  const vnStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  return new Date(`${vnStr}T00:00:00+07:00`)
}

export function formatAttendanceRecord(log: any) {
  // Determine status (ON_TIME vs LATE) based on event_time hour in Vietnam timezone (GMT+7)
  const eventDate = new Date(log.event_time)
  const vnTimeParts = eventDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).split(':')
  const hour = parseInt(vnTimeParts[0] || '0', 10)
  const minutes = parseInt(vnTimeParts[1] || '0', 10)
  const isLate = log.type === ATTENDANCE_TYPE.CHECK_IN && (hour > 8 || (hour === 8 && minutes > 30))

  return {
    id: log.id.toString(),
    attendance_id: `ATT-${log.id}`,
    employee_id: log.employees?.employee_code || log.employee_id,
    type: log.type as AttendanceType,
    timestamp: eventDate.toISOString(),
    method: (log.method || ATTENDANCE_METHOD.FACE) as AttendanceMethod,
    device_id: log.device_info || 'FaceCam-01',
    verification_score: log.verification_score ?? 0.98,
    status: isLate ? DAILY_ATTENDANCE_STATUS.LATE : 'ON_TIME',
    raw_status: log.status,
  }
}

export async function list(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {}

  if (typeof query.employeeId === 'string') {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(query.employeeId),
    })
    where.employee_id = emp ? emp.id : query.employeeId
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

  const logs = await prisma.attendance_logs.findMany({
    where,
    include: attendanceInclude,
    orderBy: { event_time: 'desc' },
  })

  return logs.map(formatAttendanceRecord)
}

function calcShiftWorkingHours(startTimeStr?: string | null, endTimeStr?: string | null): number {
  if (!startTimeStr || !endTimeStr) return 8
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
    date: s.work_date.toISOString().slice(0, 10),
    total_working_hours: s.total_working_hours ? Number(s.total_working_hours) : 0,
    late_early: s.late_early,
    overtime: s.overtime,
    status: s.attendance_status,
  }))
}

export async function adjustAttendance(data: {
  employeeId: string
  date: string
  late_early: number
  overtime: number
}) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employeeId),
  })
  if (!emp) throw new AppError(404, 'Employee not found')

  const workDate = new Date(`${data.date}T00:00:00.000Z`)
  const roundedLateEarly = Math.round((data.late_early || 0) / 1800) * 1800
  const roundedOvertime = Math.round((data.overtime || 0) / 1800) * 1800

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
      attendance_status: roundedLateEarly > 0 ? DAILY_ATTENDANCE_STATUS.LATE : DAILY_ATTENDANCE_STATUS.PRESENT,
    },
  })

  return {
    id: summary.id.toString(),
    employee_id: emp.employee_code,
    date: data.date,
    total_working_hours: summary.total_working_hours ? Number(summary.total_working_hours) : workingHours,
    late_early: summary.late_early,
    overtime: summary.overtime,
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
      type: ATTENDANCE_TYPE.CHECK_IN,
      event_time: { gte: startOfToday() },
    },
    orderBy: { event_time: 'desc' },
  })

  if (todayCheckIn) {
    const subsequentCheckOut = await prisma.attendance_logs.findFirst({
      where: {
        employee_id: employee.id,
        type: ATTENDANCE_TYPE.CHECK_OUT,
        event_time: { gt: todayCheckIn.event_time },
      },
    })
    if (!subsequentCheckOut) throw new AppError(409, 'Employee is already checked in today')
  }

  const created = await prisma.attendance_logs.create({
    data: {
      employee_id: employee.id,
      type: ATTENDANCE_TYPE.CHECK_IN,
      method: data.method ?? ATTENDANCE_METHOD.FACE,
      device_info: data.device_info ?? 'FaceCam-01',
      verification_score: 0.99,
      status: ATTENDANCE_LOG_STATUS.VALID,
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
      type: ATTENDANCE_TYPE.CHECK_IN,
      event_time: { gte: startOfToday() },
    },
    orderBy: { event_time: 'desc' },
  })

  if (!lastCheckIn) throw new AppError(404, 'No active check-in found for today')

  const subsequentCheckOut = await prisma.attendance_logs.findFirst({
    where: {
      employee_id: employee.id,
      type: ATTENDANCE_TYPE.CHECK_OUT,
      event_time: { gt: lastCheckIn.event_time },
    },
  })

  if (subsequentCheckOut) throw new AppError(409, 'Employee already checked out')

  const created = await prisma.attendance_logs.create({
    data: {
      employee_id: employee.id,
      type: ATTENDANCE_TYPE.CHECK_OUT,
      method: ATTENDANCE_METHOD.FACE,
      device_info: device_info ?? 'FaceCam-01',
      verification_score: 0.99,
      status: ATTENDANCE_LOG_STATUS.VALID,
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
      where: { type: ATTENDANCE_TYPE.CHECK_IN, event_time: { gte: start } },
    }),
    prisma.employee.count({ where: { status: EMPLOYEE_STATUS.ACTIVE } }),
  ])

  const checkedIn = checkedInToday.length

  return {
    date: start.toISOString().slice(0, 10),
    checkedIn,
    totalEmployees: totalActiveEmployees,
    absent: Math.max(0, totalActiveEmployees - checkedIn),
  }
}
