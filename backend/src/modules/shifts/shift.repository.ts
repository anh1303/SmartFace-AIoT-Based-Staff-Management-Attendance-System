import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class ShiftRepository {
  async findMany(args?: Prisma.employee_shiftsFindManyArgs) {
    return prisma.employee_shifts.findMany(args);
  }

  async findFirst(args?: Prisma.employee_shiftsFindFirstArgs) {
    return prisma.employee_shifts.findFirst(args);
  }

  async upsert(args: Prisma.employee_shiftsUpsertArgs) {
    return prisma.employee_shifts.upsert(args);
  }

  async delete(args: Prisma.employee_shiftsDeleteArgs) {
    return prisma.employee_shifts.delete(args);
  }

  async count(args?: Prisma.employee_shiftsCountArgs) {
    return prisma.employee_shifts.count(args);
  }

  async findWorkShifts(args?: Prisma.work_shiftsFindManyArgs) {
    return prisma.work_shifts.findMany(args);
  }
}

export const shiftRepository = new ShiftRepository();
