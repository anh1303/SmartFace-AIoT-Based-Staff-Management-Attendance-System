import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class AuditRepository {
  async findMany(args?: Prisma.AuditLogFindManyArgs) {
    return prisma.auditLog.findMany(args);
  }

  async count(args?: Prisma.AuditLogCountArgs) {
    return prisma.auditLog.count(args);
  }

  async create(args: Prisma.AuditLogCreateArgs) {
    return prisma.auditLog.create(args);
  }
}

export const auditRepository = new AuditRepository();
