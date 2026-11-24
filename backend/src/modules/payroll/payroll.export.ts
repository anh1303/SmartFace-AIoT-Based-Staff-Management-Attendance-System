import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { vnDay } from '../../common/utils.js'
import { getEmployeeScope, type EmployeeActor } from '../employees/public.js'
import { formatPayrollRecord } from './payroll.format.js'
import { exportPayrollSchema, payrollPeriodParamSchema } from './payroll.dto.js'

export type PayrollRecordDto = ReturnType<typeof formatPayrollRecord>

const CLOSED_EXPORT_STATUSES = ['FINALIZED', 'CONFIRMED', 'PAID'] as const

function normalizeRequestedIdSet(recordIds: readonly string[]): Set<string> {
  const normalized = new Set<string>()
  for (const rawId of recordIds) {
    const trimmed = rawId.trim()
    if (!trimmed) continue
    normalized.add(trimmed)
    const prMatch = trimmed.match(/^PR-\d{6}-(\d+)$/i)
    if (prMatch?.[1]) {
      normalized.add(String(BigInt(prMatch[1])))
    } else if (/^\d+$/.test(trimmed)) {
      normalized.add(String(BigInt(trimmed)))
    }
  }
  return normalized
}

export async function buildPayrollExport(
  period: string,
  actor: EmployeeActor | undefined,
  recordIds: readonly string[]
): Promise<PayrollRecordDto[]> {
  const parsedPeriod = payrollPeriodParamSchema.safeParse(period)
  const parsedBody = exportPayrollSchema.safeParse({ recordIds })
  if (!parsedPeriod.success || !parsedBody.success) {
    throw AppError.badRequest('Tham số kỳ lương hoặc danh sách ID phiếu lương xuất báo cáo không hợp lệ')
  }

  const readScopedRecords = async (db: typeof prisma) => {
    const scope = await getEmployeeScope(actor, 'read', db as any)
    const rawRecords = await db.payrollRecord.findMany({
      where: {
        payroll_period: parsedPeriod.data,
        employee: scope,
      },
      include: {
        employee: {
          include: {
            department: true,
            position: true,
            users: { include: { roles: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return rawRecords.filter(row => {
      if (row.status !== 'PENDING') return true
      const createdAt = (row.employee as { createdAt?: Date | string | null } | null)?.createdAt
      return !createdAt || vnDay(createdAt).slice(0, 7) <= row.payroll_period
    })
  }

  const scopedRecords =
    typeof (prisma as any).$transaction === 'function'
      ? await prisma.$transaction((tx: any) => readScopedRecords(tx))
      : await readScopedRecords(prisma)

  const regularRecords = scopedRecords.filter(record => {
    const details = record.calculation_details as { early_settlement?: { is_early_settlement?: boolean } } | null | undefined
    return !details?.early_settlement?.is_early_settlement
  })
  const allClosed =
    scopedRecords.length > 0 &&
    scopedRecords.every(record => CLOSED_EXPORT_STATUSES.includes(record.status as any))

  if (regularRecords.length === 0 || !allClosed) {
    throw AppError.conflict(
      'Kỳ lương chưa đủ điều kiện xuất báo cáo chính thức (cần ít nhất một phiếu thường và mọi phiếu trong phạm vi đều đã chốt)'
    )
  }

  const requestedSet = normalizeRequestedIdSet(parsedBody.data.recordIds)
  const formatted = scopedRecords
    .map(row => formatPayrollRecord({ ...row, can_edit: false }))
    .filter(dto => requestedSet.has(dto.id) || requestedSet.has(dto.payroll_id))

  if (formatted.length === 0) {
    throw AppError.notFound('Không có phiếu lương nào trong phạm vi được phép xuất')
  }

  return formatted
}
