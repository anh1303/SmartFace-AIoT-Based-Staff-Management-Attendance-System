import { prisma } from '../../config/database.js'

export async function findAttendanceLogByEventKey(eventKey: string) {
  return prisma.attendance_logs.findUnique({ where: { event_key: eventKey } })
}

export async function findRecentValidAttendanceLog(employeeId: string, sinceDate: Date, untilDate: Date) {
  return prisma.attendance_logs.findFirst({
    where: { employee_id: employeeId, status: 'VALID', event_time: { gte: sinceDate, lte: untilDate } },
    orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
  })
}
