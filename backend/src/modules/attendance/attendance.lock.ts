import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

/**
 * Public Module API: Kiểm tra ngày làm việc có bị khóa công (attendance_locks) hay không
 */
export async function isAttendanceDateLocked(
  workDate: Date | string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? prisma
  const dateObj = typeof workDate === 'string' ? new Date(`${workDate}T00:00:00.000Z`) : workDate
  const lock = await client.attendance_locks.findFirst({
    where: { work_date: dateObj, is_locked: true },
  })
  return Boolean(lock)
}
