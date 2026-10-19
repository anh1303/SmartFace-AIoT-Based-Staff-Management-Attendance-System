import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
export { attendanceModel, attendanceInclude } from './attendance.model.js';

export class AttendanceRepository {
  async findLogs(args: Prisma.attendance_logsFindManyArgs) {
    return prisma.attendance_logs.findMany(args);
  }

  async findFirstLog(args: Prisma.attendance_logsFindFirstArgs) {
    return prisma.attendance_logs.findFirst(args);
  }

  async createLog(args: Prisma.attendance_logsCreateArgs) {
    return prisma.attendance_logs.create(args);
  }

  async countLogs(args?: Prisma.attendance_logsCountArgs) {
    return prisma.attendance_logs.count(args);
  }

  async findDailySummaries(args: Prisma.daily_attendance_summaryFindManyArgs) {
    return prisma.daily_attendance_summary.findMany(args);
  }

  async findFirstDailySummary(args: Prisma.daily_attendance_summaryFindFirstArgs) {
    return prisma.daily_attendance_summary.findFirst(args);
  }

  async upsertDailySummary(args: Prisma.daily_attendance_summaryUpsertArgs) {
    return prisma.daily_attendance_summary.upsert(args);
  }

  async updateDailySummary(args: Prisma.daily_attendance_summaryUpdateArgs) {
    return prisma.daily_attendance_summary.update(args);
  }

  async findLocks() {
    return prisma.attendance_locks.findMany({
      orderBy: { work_date: 'desc' },
    });
  }

  async findLockByDate(date: Date) {
    return prisma.attendance_locks.findUnique({
      where: { work_date: date },
    });
  }

  async upsertLock(date: Date, isLocked: boolean, lockedBy?: string) {
    return prisma.attendance_locks.upsert({
      where: { work_date: date },
      update: {
        is_locked: isLocked,
        locked_at: new Date(),
        locked_by: lockedBy || null,
      },
      create: {
        work_date: date,
        is_locked: isLocked,
        locked_at: new Date(),
        locked_by: lockedBy || null,
      },
    });
  }
}

export const attendanceRepository = new AttendanceRepository();
