import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class DepartmentRepository {
  async findMany(args?: Prisma.DepartmentFindManyArgs) {
    return prisma.department.findMany(args);
  }

  async findUnique(args: Prisma.DepartmentFindUniqueArgs) {
    return prisma.department.findUnique(args);
  }

  async create(args: Prisma.DepartmentCreateArgs) {
    return prisma.department.create(args);
  }

  async update(args: Prisma.DepartmentUpdateArgs) {
    return prisma.department.update(args);
  }

  async count(args?: Prisma.DepartmentCountArgs) {
    return prisma.department.count(args);
  }
}

export const departmentRepository = new DepartmentRepository();
