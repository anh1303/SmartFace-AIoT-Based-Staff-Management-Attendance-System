import { prisma } from '../../config/database.js'

export function getReportPayrolls(employeeIds: string[], selectedPeriod: string) {
  return prisma.payrollRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      payroll_period: selectedPeriod,
    },
    select: {
      employeeId: true,
      net_salary: true,
      status: true,
    },
  })
}

export function getReportPayrollPeriods() {
  return prisma.payrollRecord.findMany({
    select: { payroll_period: true },
    distinct: ['payroll_period'],
    orderBy: { payroll_period: 'desc' },
  })
}
