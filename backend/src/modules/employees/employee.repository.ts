import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export const employeeModel = prisma.employee;

export const employeeInclude = {
  department: true,
  position: true,
  users: {
    select: {
      id: true,
      username: true,
      role_id: true,
      roles: {
        select: {
          id: true,
          role_name: true,
        },
      },
    },
  },
} as const;

export class EmployeeRepository {
  async findMany(args?: Prisma.EmployeeFindManyArgs) {
    return prisma.employee.findMany(args);
  }

  async findFirst(args?: Prisma.EmployeeFindFirstArgs) {
    return prisma.employee.findFirst(args);
  }

  async findUnique(args: Prisma.EmployeeFindUniqueArgs) {
    return prisma.employee.findUnique(args);
  }

  async count(args?: Prisma.EmployeeCountArgs) {
    return prisma.employee.count(args);
  }

  async create(args: Prisma.EmployeeCreateArgs) {
    return prisma.employee.create(args);
  }

  async update(args: Prisma.EmployeeUpdateArgs) {
    return prisma.employee.update(args);
  }
}

export const employeeRepository = new EmployeeRepository();
