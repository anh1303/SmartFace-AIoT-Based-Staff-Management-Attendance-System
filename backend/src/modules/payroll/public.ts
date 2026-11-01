import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { payrollOverrides } from './payroll.overrides.js'

export { payrollOverrides } from './payroll.overrides.js'

export const CLOSED_PAYROLL_STATUSES = ['FINALIZED', 'CONFIRMED', 'PAID'] as const

/**
 * Kiểm tra xem kỳ lương (hoặc kỳ lương của 1 nhân viên) đã bị chốt (FINALIZED, CONFIRMED, PAID) hay chưa.
 */
export async function isPayrollPeriodClosed(
  period: string,
  employeeId?: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = (tx && (tx as any).payrollRecord ? tx : prisma) as any
  if (!client?.payrollRecord?.findFirst) return false
  const record = await client.payrollRecord.findFirst({
    where: {
      ...(employeeId ? { employeeId } : {}),
      payroll_period: period,
      status: { in: [...CLOSED_PAYROLL_STATUSES] },
    },
    select: { id: true },
  })
  return Boolean(record)
}

/**
 * Lấy danh sách ID các nhân viên đã có bảng lương bị chốt trong kỳ.
 */
export async function getClosedPayrollEmployeeIds(
  period: string,
  tx?: Prisma.TransactionClient
): Promise<Set<string>> {
  const client = (tx && (tx as any).payrollRecord ? tx : prisma) as any
  if (!client?.payrollRecord?.findMany) return new Set()
  const records = await client.payrollRecord.findMany({
    where: {
      payroll_period: period,
      status: { in: [...CLOSED_PAYROLL_STATUSES] },
    },
    select: { employeeId: true },
  })
  return new Set(records.map((r: any) => r.employeeId))
}

/**
 * Lấy danh sách bảng lương của các nhân viên trong kỳ (dùng cho tổng hợp công).
 */
export async function findPeriodPayrolls(
  employeeIds: string[],
  period: string,
  tx?: Prisma.TransactionClient
) {
  const client = (tx && 'payrollRecord' in tx ? tx : prisma)
  return client.payrollRecord.findMany({
    where: { employeeId: { in: employeeIds }, payroll_period: period },
    select: {
      employeeId: true,
      status: true,
      hourly_rate: true,
      total_working_hours: true,
      calculation_details: true,
    },
  })
}

/**
 * Lấy snapshot tiền lương trong kỳ (hourly_rate, overrides) của nhân viên.
 */
export async function getPayrollWageSnapshot(
  employeeId: string,
  period: string,
  tx?: Prisma.TransactionClient
) {
  const client = (tx && (tx as any).payrollRecord ? tx : prisma) as any
  if (!client?.payrollRecord?.findFirst) return null
  return client.payrollRecord.findFirst({
    where: { employeeId, payroll_period: period },
  })
}

/**
 * Đánh dấu cần tính lại/cập nhật pending payroll khi dữ liệu chấm công thay đổi.
 */
export async function touchPendingPayrollForAttendance(
  employeeId: string,
  period: string,
  detailsUpdate: (existingDetails: Record<string, any>) => Record<string, any>,
  tx: Prisma.TransactionClient
): Promise<void> {
  const pending = await tx.payrollRecord.findUnique({
    where: { employeeId_payroll_period: { employeeId, payroll_period: period } },
  })
  if (pending && pending.status === 'PENDING') {
    const existing = (pending.calculation_details as Record<string, any>) || {}
    await tx.payrollRecord.update({
      where: { id: pending.id },
      data: {
        calculation_details: detailsUpdate(existing),
      },
    })
  }
}

/**
 * Cập nhật danh sách pending payrolls bị ảnh hưởng khi khóa/mở khóa ngày công.
 */
export async function markPendingPayrollsRecompute(
  employeeIds: string[],
  period: string,
  recomputeReason: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const pendingPayrolls = await tx.payrollRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      payroll_period: period,
      status: 'PENDING',
    },
  })

  for (const p of pendingPayrolls) {
    const details = (p.calculation_details as Record<string, any>) || {}
    await tx.payrollRecord.update({
      where: { id: p.id },
      data: {
        calculation_details: {
          ...details,
          recompute_required: true,
          recompute_reason: recomputeReason,
          invalidated_at: new Date().toISOString(),
        },
      },
    })
  }
}

/**
 * Kiểm tra xem nhân viên đã có dữ liệu bảng lương phát sinh hay chưa (dùng cho xóa nhân viên an toàn).
 */
export async function hasPayrollActivity(
  employeeId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx || prisma
  const count = await client.payrollRecord.count({ where: { employeeId } })
  return count > 0
}
