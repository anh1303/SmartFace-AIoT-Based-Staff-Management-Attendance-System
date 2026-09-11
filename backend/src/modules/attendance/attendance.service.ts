import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { attendanceInclude } from './attendance.model.js'

const startOfToday = () => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function formatAttendanceRecord(log: any) {
  // Determine status (ON_TIME vs LATE) based on event_time hour
  const eventDate = new Date(log.event_time)
  const hour = eventDate.getHours()
  const minutes = eventDate.getMinutes()
  const isLate = log.type === 'CHECK_IN' && (hour > 8 || (hour === 8 && minutes > 30))

  return {
    id: log.id.toString(),
    attendance_id: `ATT-${log.id}`,
    employee_id: log.employees?.employee_code || log.employee_id,
    type: log.type as 'CHECK_IN' | 'CHECK_OUT',
    timestamp: eventDate.toISOString(),
    method: (log.method || 'FACE') as 'FACE' | 'FINGERPRINT' | 'MANUAL',
    device_id: log.device_info || 'FaceCam-01',
    verification_score: log.verification_score ?? 0.98,
    status: isLate ? 'LATE' : 'ON_TIME',
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
      gte: new Date(`${query.date}T00:00:00.000Z`),
      lt: new Date(`${query.date}T23:59:59.999Z`),
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

export async function checkIn(data: { employeeId: string; device_info?: string; method?: 'FACE' | 'FINGERPRINT' | 'MANUAL' }) {
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
    prisma.employee.count({ where: { status: 'ACTIVE', deleted_at: null } }),
  ])

  const checkedIn = checkedInToday.length

  return {
    date: start.toISOString().slice(0, 10),
    checkedIn,
    totalEmployees: totalActiveEmployees,
    absent: Math.max(0, totalActiveEmployees - checkedIn),
  }
}
