import { prisma } from '../../config/database.js'

export function getDashboardShifts(employeeIds: string[], todayStr: string) {
  return prisma.employee_shifts.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: new Date(`${todayStr}T00:00:00Z`),
      shift_type: { not: 'OFF' },
    },
    include: {
      work_shifts: true,
    },
  })
}

export function getReportShifts(employeeIds: string[], startDate: string, endDate: string) {
  return prisma.employee_shifts.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T00:00:00Z`),
      },
      shift_type: { not: 'OFF' },
    },
    select: {
      employee_id: true,
      work_date: true,
      shift_type: true,
    },
  })
}
