import { prisma } from '../config/database.js'
import { AppError } from './AppError.js'
import type { Prisma } from '@prisma/client'

export const DEFAULT_PAYROLL_POLICY = Object.freeze({ overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2 })
export const validMultiplier = (value: unknown): boolean => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 50
export const currentPayrollPeriod = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7)
export function nextPayrollPeriod(period = currentPayrollPeriod()) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
}

export async function policyForPeriod(period: string, db: Pick<Prisma.TransactionClient, 'bonusPenalty'> = prisma) {
  const policy = await db.bonusPenalty.findFirst({ where: { effective_period: { lte: period } }, orderBy: [{ effective_period: 'desc' }, { id: 'desc' }] })
  if (policy) return { ...policy, overtime_rate: Number(policy.overtime_rate), late_early_penalty: Number(policy.late_early_penalty), absence_penalty_rate: Number(policy.absence_penalty_rate) }
  if (await db.bonusPenalty.findFirst()) return null
  return { id: 0, ...DEFAULT_PAYROLL_POLICY, effective_period: null, description: 'Chính sách mặc định: OT 2x, trễ/sớm 1.5x, vắng 2x' }
}

export function assertResolvedPayroll(record: { calculation_details?: unknown; overtime_rate?: unknown; late_penalty_rate?: unknown } | null | undefined) {
  const details = record?.calculation_details as Record<string, unknown> | null
  if (details?.rate_snapshot_status === 'UNRESOLVED' || details?.rate_snapshot_status === 'LEGACY_VERIFIED'
    || record?.overtime_rate != null && !validMultiplier(record.overtime_rate) || record?.late_penalty_rate != null && !validMultiplier(record.late_penalty_rate)) {
    throw AppError.conflict('Phiếu lương cũ cần đối soát hệ số và xác nhận lại trước khi tính hoặc chốt; không dùng chính sách hiện tại thay thế')
  }
}

export function hasMultiplierSnapshot(record: { overtime_rate?: unknown; late_penalty_rate?: unknown; calculation_details?: unknown }) {
  const details = record.calculation_details as Record<string, unknown> | null
  return !['UNRESOLVED', 'LEGACY_VERIFIED'].includes(String(details?.rate_snapshot_status)) && validMultiplier(record.overtime_rate) && validMultiplier(record.late_penalty_rate)
}
