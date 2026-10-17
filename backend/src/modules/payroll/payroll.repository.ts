import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class PayrollRepository {
  async findBonusPenalty() {
    return prisma.bonusPenalty.findFirst({
      orderBy: { id: 'desc' },
    });
  }

  async upsertBonusPenalty(data: {
    overtime_rate?: number;
    late_early_penalty?: number;
    description?: string;
  }) {
    const existing = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } });
    if (existing) {
      return prisma.bonusPenalty.update({
        where: { id: existing.id },
        data: {
          ...(data.overtime_rate !== undefined ? { overtime_rate: data.overtime_rate } : {}),
          ...(data.late_early_penalty !== undefined ? { late_early_penalty: data.late_early_penalty } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updated_at: new Date(),
        },
      });
    }
    return prisma.bonusPenalty.create({
      data: {
        overtime_rate: data.overtime_rate ?? 1.5,
        late_early_penalty: data.late_early_penalty ?? 50000,
        description: data.description || 'Chính sách áp dụng chuẩn từ hệ thống',
      },
    });
  }

  async findRecords(args: Prisma.PayrollRecordFindManyArgs) {
    return prisma.payrollRecord.findMany(args);
  }

  async findRecordById(id: string | bigint) {
    return prisma.payrollRecord.findUnique({
      where: { id: typeof id === 'bigint' ? id : BigInt(id) },
      include: {
        employee: {
          select: {
            employee_code: true,
            full_name: true,
            department: true,
            position: true,
          },
        },
      },
    });
  }

  async upsertRecord(args: Prisma.PayrollRecordUpsertArgs) {
    return prisma.payrollRecord.upsert(args);
  }

  async updateRecord(args: Prisma.PayrollRecordUpdateArgs) {
    return prisma.payrollRecord.update(args);
  }

  async countRecords(args: Prisma.PayrollRecordCountArgs) {
    return prisma.payrollRecord.count(args);
  }
}

export const payrollRepository = new PayrollRepository();
