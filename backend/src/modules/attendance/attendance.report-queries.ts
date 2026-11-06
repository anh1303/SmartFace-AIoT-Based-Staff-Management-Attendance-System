import { prisma } from '../../config/database.js'

export function getDashboardAttendanceLogs(employeeIds: string[], startUtc: Date, endUtc: Date) {
  return prisma.attendance_logs.findMany({
    where: {
      employee_id: { in: employeeIds },
      event_time: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    orderBy: { event_time: 'desc' },
  })
}

export function getReportAttendanceLogs(employeeIds: string[], startUtc: Date, endUtc: Date) {
  return prisma.attendance_logs.findMany({
    where: {
      employee_id: { in: employeeIds },
      event_time: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    select: {
      id: true,
      employee_id: true,
      event_time: true,
      type: true,
      method: true,
      verification_score: true,
      status: true,
    },
    orderBy: { event_time: 'asc' },
  })
}

export function getReportAttendanceSummaries(employeeIds: string[], startDate: string, endDate: string) {
  return prisma.daily_attendance_summary.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T00:00:00Z`),
      },
    },
    select: {
      employee_id: true,
      work_date: true,
      total_working_hours: true,
      late_early: true,
      overtime: true,
      attendance_status: true,
      review_status: true,
    },
  })
}
