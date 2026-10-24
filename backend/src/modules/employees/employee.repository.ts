import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export { employeeInclude, employeeModel } from './employee.model.js';

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
