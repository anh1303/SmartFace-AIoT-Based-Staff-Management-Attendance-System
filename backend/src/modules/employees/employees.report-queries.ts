import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

export function getEmployeesForReporting(employeeScope: Prisma.EmployeeWhereInput) {
  return prisma.employee.findMany({
    where: {
      AND: [employeeScope, { status: 'ACTIVE' }],
    },
    include: {
      department: true,
      position: true,
    },
    orderBy: [{ departmentId: 'asc' }, { employee_code: 'asc' }],
  })
}

export function getActiveDepartmentsForReporting() {
  return prisma.department.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  })
}
