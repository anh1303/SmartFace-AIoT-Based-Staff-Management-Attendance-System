import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

/**
 * Public Contract API of Attendance Module for use by Payroll, Employees, and other modules.
 * Ensures data encapsulation: no external module should directly query or mutate attendance tables.
 */

export async function findDailyAttendanceSummaries(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate?: { gte?: Date; lt?: Date; lte?: Date }
    status?: string
  },
  includeShifts = false,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma
  const where: Prisma.daily_attendance_summaryWhereInput = {}

  if (filter.employeeId) {
    where.employee_id = filter.employeeId
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    where.employee_id = { in: filter.employeeIds }
  }

  if (filter.workDate) {
    where.work_date = filter.workDate
  }

  if (filter.status) {
    where.review_status = filter.status
  }

  return client.daily_attendance_summary.findMany({
    where,
    ...(includeShifts ? { include: { work_shifts: true } } : {}),
    orderBy: { work_date: 'asc' },
  })
}

export interface PayrollDailySummaryRow {
  id: bigint
  employee_id: string
  work_date: Date
  total_working_hours: Prisma.Decimal
  overtime: Prisma.Decimal
  late_early: Prisma.Decimal
  overtime_status: string
  review_status: string
  policy_version: string | null
  requires_review: boolean
  calculation_details: { scheduledEnd?: string; fingerprint?: string } | null
}

/**
 * Projected read of daily_attendance_summary specifically for payroll.list().
 * Avoids transferring large full calculation_details / pre_approval_snapshot JSON blobs over WAN
 * while preserving the exact scalar columns and JSON fields (scheduledEnd, fingerprint) required
 * by elapsedPayrollSources, workingHoursFingerprint, and summaryFingerprint.
 */
export async function findDailyAttendanceSummariesForPayroll(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate?: { gte?: Date; lt?: Date; lte?: Date }
    status?: string
  },
  tx?: Prisma.TransactionClient
): Promise<PayrollDailySummaryRow[]> {
  const client = tx || prisma
  const conditions: Prisma.Sql[] = []

  if (filter.employeeId) {
    conditions.push(Prisma.sql`employee_id = ${filter.employeeId}::uuid`)
  } else if (filter.employeeIds) {
    if (filter.employeeIds.length === 0) return []
    conditions.push(Prisma.sql`employee_id = ANY(${filter.employeeIds}::uuid[])`)
  }

  if (filter.workDate?.gte) {
    conditions.push(Prisma.sql`work_date >= ${filter.workDate.gte}::date`)
  }
  if (filter.workDate?.lt) {
    conditions.push(Prisma.sql`work_date < ${filter.workDate.lt}::date`)
  }
  if (filter.workDate?.lte) {
    conditions.push(Prisma.sql`work_date <= ${filter.workDate.lte}::date`)
  }
  if (filter.status) {
    conditions.push(Prisma.sql`review_status = ${filter.status}`)
  }

  const whereSql = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty

  return client.$queryRaw<PayrollDailySummaryRow[]>(Prisma.sql`
    SELECT
      id,
      employee_id,
      work_date,
      total_working_hours,
      overtime,
      late_early,
      overtime_status,
      review_status,
      policy_version,
      requires_review,
      CASE
        WHEN calculation_details IS NULL THEN NULL
        ELSE jsonb_strip_nulls(
          jsonb_build_object(
            'scheduledEnd', calculation_details->'scheduledEnd',
            'fingerprint', calculation_details->'fingerprint'
          )
        )
      END AS calculation_details
    FROM daily_attendance_summary
    ${whereSql}
    ORDER BY work_date ASC
  `)
}

export async function findAttendanceAdjustments(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate?: { gte?: Date; lt?: Date; lte?: Date }
    status?: string
  },
  includeEmployee = false,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma
  const where: Prisma.AttendanceAdjustmentWhereInput = {}

  if (filter.employeeId) {
    where.employee_id = filter.employeeId
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    where.employee_id = { in: filter.employeeIds }
  }

  if (filter.workDate) {
    where.work_date = filter.workDate
  }

  if (filter.status) {
    where.status = filter.status
  }

  return client.attendanceAdjustment.findMany({
    where,
    ...(includeEmployee
      ? {
          include: {
            employee: {
              include: {
                position: true,
                users: { include: { roles: true } },
              },
            },
          },
        }
      : {}),
    orderBy: [{ work_date: 'asc' }, { kind: 'asc' }],
  })
}

export async function findAttendanceAdjustmentsWithScope(
  where: Prisma.AttendanceAdjustmentWhereInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma
  return client.attendanceAdjustment.findMany({
    where,
    include: {
      employee: {
        include: {
          position: true,
          users: { include: { roles: true } },
        },
      },
    },
    orderBy: [{ work_date: 'asc' }, { kind: 'asc' }],
  })
}

export async function findAttendanceLocks(
  filter: {
    workDate: { gte: Date; lt: Date }
    isLocked?: boolean
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma
  return client.attendance_locks.findMany({
    where: {
      work_date: filter.workDate,
      ...(filter.isLocked !== undefined ? { is_locked: filter.isLocked } : {}),
    },
    select: { work_date: true, is_locked: true },
  })
}

export async function countPendingDailySummaries(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate: { gte: Date; lt: Date }
  },
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || prisma
  const where: Prisma.daily_attendance_summaryWhereInput = {
    work_date: filter.workDate,
    review_status: 'NONE',
  }
  if (filter.employeeId) {
    where.employee_id = filter.employeeId
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    where.employee_id = { in: filter.employeeIds }
  }
  return client.daily_attendance_summary.count({ where })
}

export async function countUnapprovedDailySummaries(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate: { gte: Date; lt: Date }
  },
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || prisma
  const where: Prisma.daily_attendance_summaryWhereInput = {
    work_date: filter.workDate,
    OR: [
      { review_status: { not: 'APPROVED' } },
      { requires_review: true },
      { overtime_status: 'PENDING' },
      { policy_version: null },
    ],
  }
  if (filter.employeeId) {
    where.employee_id = filter.employeeId
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    where.employee_id = { in: filter.employeeIds }
  }
  return client.daily_attendance_summary.count({ where })
}

export async function countPendingAttendanceAdjustments(
  filter: {
    employeeIds?: string[]
    employeeId?: string
    workDate: { gte: Date; lt: Date }
  },
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || prisma
  const where: Prisma.AttendanceAdjustmentWhereInput = {
    work_date: filter.workDate,
    status: 'PENDING',
  }
  if (filter.employeeId) {
    where.employee_id = filter.employeeId
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    where.employee_id = { in: filter.employeeIds }
  }
  return client.attendanceAdjustment.count({ where })
}

/**
 * Xóa sạch daily summaries và adjustments phát sinh sau thời điểm chốt thanh toán sớm (early settlement).
 * Đảm bảo dữ liệu chấm công chỉ được sửa/xóa bởi Attendance module trong cùng transaction.
 */
export async function purgeAttendanceForEarlySettlement(
  employeeId: string,
  dateRange: { gte: Date; lt: Date },
  tx: Prisma.TransactionClient
): Promise<void> {
  if (tx.daily_attendance_summary) {
    await tx.daily_attendance_summary.deleteMany({
      where: {
        employee_id: employeeId,
        work_date: dateRange,
      },
    })
  }

  if (tx.attendanceAdjustment) {
    await tx.attendanceAdjustment.deleteMany({
      where: {
        employee_id: employeeId,
        work_date: dateRange,
      },
    })
  }
}

/**
 * Public Contract: Đánh dấu cần xem lại summary khi ca làm việc bị thay đổi.
 * Hủy hiệu lực duyệt cũ, mở lại ngày công và chuyển adjustments về PENDING trong cùng transaction.
 */
export async function invalidateDailySummaryForShiftChange(
  employeeId: string,
  workDate: Date,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || prisma
  if (!client.daily_attendance_summary) return

  let isApproved = true
  let existingReopenedAt: Date | null = null
  let existingReopenedBy: string | null = null

  if (typeof client.daily_attendance_summary.findFirst === 'function') {
    const existing = await client.daily_attendance_summary.findFirst({
      where: { employee_id: employeeId, work_date: workDate },
    })
    if (!existing) return
    isApproved = existing.review_status === 'APPROVED'
    existingReopenedAt = (existing as any).reopened_at ?? null
    existingReopenedBy = (existing as any).reopened_by ?? null
  }

  await client.daily_attendance_summary.updateMany({
    where: { employee_id: employeeId, work_date: workDate },
    data: {
      policy_version: null,
      requires_review: true,
      review_reason: 'SHIFT_CHANGED',
      review_status: 'PENDING',
      approved_by: null,
      approved_at: null,
      reopened_at: isApproved ? new Date() : existingReopenedAt,
      reopened_by: isApproved ? 'SHIFT_CHANGED' : existingReopenedBy,
      pre_approval_snapshot: Prisma.DbNull,
    },
  })
  if (isApproved && client.attendanceAdjustment?.updateMany) {
    await client.attendanceAdjustment.updateMany({
      where: { employee_id: employeeId, work_date: workDate, status: 'APPROVED' },
      data: {
        status: 'PENDING',
        reviewed_by: null,
        reviewed_at: null,
      },
    })
  }
}

/**
 * Lấy danh sách logs và summaries sau ngày quyết toán để đánh giá ảnh hưởng settlement.
 * Sử dụng đối tượng UTC Date thay vì chuỗi để tương thích chuẩn DateTime trong Prisma.
 */
export async function getSettlementLogsAndSummaries(
  employeeId: string,
  cutoffDateVN: string,
  cutoffDayVN: Date,
  tx: Prisma.TransactionClient,
  nextDayInput?: string | Date
) {
  let nextDayDate: Date
  if (nextDayInput instanceof Date) {
    nextDayDate = nextDayInput
  } else if (typeof nextDayInput === 'string' && nextDayInput.length > 0) {
    nextDayDate = new Date(`${nextDayInput}T00:00:00.000Z`)
  } else {
    nextDayDate = new Date(`${cutoffDateVN}T00:00:00.000Z`)
    nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1)
  }

  const [logs, summaries, adjustments] = await Promise.all([
    tx.attendance_logs.findMany({
      where: {
        employee_id: employeeId,
        OR: [{ work_date: { gte: nextDayDate } }, { event_time: { gte: cutoffDayVN } }],
      },
      select: { id: true, type: true, status: true, work_date: true, event_time: true },
    }),
    tx.daily_attendance_summary.findMany({
      where: { employee_id: employeeId, work_date: { gte: nextDayDate } },
    }),
    tx.attendanceAdjustment.findMany({
      where: { employee_id: employeeId, work_date: { gte: nextDayDate } },
    }),
  ])

  return { logs, summaries, adjustments, schedule: [] }
}

/**
 * Kiểm tra xem nhân viên đã phát sinh lịch sử chấm công hay chưa (cho phép xóa an toàn).
 */
export async function hasAttendanceActivity(
  employeeId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx || prisma
  const [logCount, summaryCount] = await Promise.all([
    client.attendance_logs.count({ where: { employee_id: employeeId } }),
    client.daily_attendance_summary.count({ where: { employee_id: employeeId } }),
  ])
  return logCount > 0 || summaryCount > 0
}
