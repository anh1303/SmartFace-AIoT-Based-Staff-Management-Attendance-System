import { adjustmentFingerprint } from '../attendance/attendance.adjustments.js'
import { roundHours, ATTENDANCE_POLICY_VERSION, attendancePolicyVersion, vnDay, shiftBounds, prepareAttendance } from '../attendance/attendance.policy.js'
import type { EarlySettlementDto } from './payroll.dto.js'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, calculateNetSalary, computePayrollBreakdown } from '../../common/utils.js'
import type { RateKind } from '../../common/payroll-rates.js'
import { getEmployeeScope, assertCanManageEmployee } from '../employees/employee.permission.js'
import { payrollOverrides, requiresHoursReconciliation, workingHoursFingerprint } from './payroll.overrides.js'
import { monthlyHourlyRate } from '../employees/employee.wage.js'
import { logAction } from '../audit-logs/index.js'
import {
  aggregateDailyAttendance,
  getAttendanceSummariesByEmployeesAndDateRange,
} from '../attendance/index.js'
import type { PayrollStatus } from '../../common/constants.js'
import {
  isEmployeeManager,
  assertCanAccessEmployeeDetail,
  assertCannotModifySelfControlData,
  assertCannotModifyOtherManager,
  findEmployeeByIdOrCode,
  findActiveEmployees,
  findEmployeeByUserId,
} from '../employees/index.js'


export interface RawPayrollRecord {
  id: string | bigint
  payroll_period: string
  employeeId: string
  hourly_rate?: { toString(): string } | number | string | null
  total_working_hours?: { toString(): string } | number | string | null
  total_overtime?: { toString(): string } | number | string | null
  total_absence_penalty?: unknown
  total_late_early?: { toString(): string } | number | string | null
  allowance?: { toString(): string } | number | string | null
  net_salary?: { toString(): string } | number | string | null
  status?: string | null
  reason?: string | null
  overtime_rate?: unknown
  late_penalty_rate?: unknown
  overtime_rate_kind?: string | null
  late_penalty_rate_kind?: string | null
  updated_at?: Date
  late_early_penalty?: number | null
  calculation_details?: unknown
  employee?: { employee_code?: string; full_name?: string; department?: { name?: string } | null } | null
}

export function formatPayrollRecord(record: RawPayrollRecord) {
  const hourly_rate = Number(record.hourly_rate || 0)
  const total_working_hours = Number(record.total_working_hours ?? 0)
  const total_overtime = Number(record.total_overtime || 0)
  const total_late_early = Number(record.total_late_early || 0)
  const allowance = Number(record.allowance || 0)
  const net_salary = Number(record.net_salary || 0)
  const details = (record.calculation_details || {}) as Record<string, any>
  const hasRateSnapshot = record.overtime_rate != null && record.late_penalty_rate != null && record.overtime_rate_kind != null && record.late_penalty_rate_kind != null
  const breakdown = hasRateSnapshot ? computePayrollBreakdown({
    hourly_rate, total_working_hours, total_overtime, total_late_early, allowance,
    overtime_rate: Number(record.overtime_rate), late_early_penalty: Number(record.late_penalty_rate),
    overtime_rate_kind: record.overtime_rate_kind as RateKind, late_penalty_rate_kind: record.late_penalty_rate_kind as RateKind,
    total_absence_penalty: Number(record.total_absence_penalty || 0),
  }) : null

  let status: PayrollStatus = 'PENDING'
  if (record.status === 'PAID') status = 'PAID'
  else if (record.status === 'FINALIZED') status = 'FINALIZED'
  else if (record.status === 'CONFIRMED') status = 'CONFIRMED'
  else status = 'PENDING'

  return {
    id: record.id.toString(),
    payroll_id: `PR-${record.payroll_period.replace('-', '')}-${record.id.toString().padStart(3, '0')}`,
    employee_id: record.employee?.employee_code || record.employeeId,
    employee_name: record.employee?.full_name || '',
    department: record.employee?.department?.name || '',
    period: record.payroll_period,
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    total_absence_penalty: Number(record.total_absence_penalty || 0),
    allowance,
    net_salary,
    overtime_rate: record.overtime_rate == null ? null : Number(record.overtime_rate),
    late_penalty_rate: record.late_penalty_rate == null ? null : Number(record.late_penalty_rate),
    overtime_rate_kind: record.overtime_rate_kind ?? null,
    late_penalty_rate_kind: record.late_penalty_rate_kind ?? null,
    breakdown,
    updated_at: record.updated_at?.toISOString(),
    requires_reconciliation: Boolean(details.requires_reconciliation || !hasRateSnapshot),
    needs_recalculation: Boolean(details.needs_recalculation || !hasRateSnapshot),
    calculation_details: record.calculation_details,
    status,
    reason: record.reason || undefined,
  }
}

export async function getBonusPenalty() {
  const policy = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
  if (!policy) {
    return {
      id: 1,
      overtime_rate: 100000,
      overtime_rate_kind: 'FIXED_PER_HOUR' as const,
      late_early_penalty: 50000,
      late_early_penalty_kind: 'FIXED_PER_HOUR' as const,
      absence_penalty_rate: 0.25,
      description: 'Chính sách áp dụng chuẩn: OT 100.000 ₫/h, phạt trễ/sớm 50.000 ₫/h',
    }
  }
  return {
    id: policy.id,
    overtime_rate: Number(policy.overtime_rate),
    overtime_rate_kind: policy.overtime_rate_kind,
    late_early_penalty: Number(policy.late_early_penalty),
    late_early_penalty_kind: policy.late_early_penalty_kind,
    absence_penalty_rate: Number(policy.absence_penalty_rate),
    description: policy.description || 'Chính sách áp dụng chuẩn từ hệ thống',
  }
}

export async function updateBonusPenalty(data: {
  overtime_rate?: number
  overtime_rate_kind?: RateKind
  late_early_penalty?: number
  late_early_penalty_kind?: RateKind
  absence_penalty_rate?: number
  description?: string
}, actorUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
    let updatedPolicy = null

    if (existing) {
      updatedPolicy = await tx.bonusPenalty.update({
        where: { id: existing.id },
        data: {
          ...(data.overtime_rate !== undefined ? { overtime_rate: data.overtime_rate } : {}),
          ...(data.overtime_rate_kind !== undefined ? { overtime_rate_kind: data.overtime_rate_kind } : {}),
          ...(data.late_early_penalty !== undefined ? { late_early_penalty: data.late_early_penalty } : {}),
          ...(data.late_early_penalty_kind !== undefined ? { late_early_penalty_kind: data.late_early_penalty_kind } : {}),
          ...(data.absence_penalty_rate !== undefined ? { absence_penalty_rate: data.absence_penalty_rate } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updated_at: new Date(),
        },
      })
    } else {
      updatedPolicy = await tx.bonusPenalty.create({
        data: {
          overtime_rate: data.overtime_rate ?? 100000,
          overtime_rate_kind: data.overtime_rate_kind ?? 'FIXED_PER_HOUR',
          late_early_penalty: data.late_early_penalty ?? 50000,
          late_early_penalty_kind: data.late_early_penalty_kind ?? 'FIXED_PER_HOUR',
          absence_penalty_rate: data.absence_penalty_rate ?? 0.25,
          description: data.description || 'Quy định thưởng phạt áp dụng năm 2026',
        },
      })
    }

    // A policy update must not silently reprice previous payroll periods.
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'UPDATE_BONUS_PENALTY',
        target_table: 'bonus_penalty',
        record_id: String(updatedPolicy.id),
        old_values: existing
          ? {
              overtime_rate: Number(existing.overtime_rate),
              overtime_rate_kind: existing.overtime_rate_kind,
              late_early_penalty: Number(existing.late_early_penalty),
              late_early_penalty_kind: existing.late_early_penalty_kind,
              absence_penalty_rate: Number(existing.absence_penalty_rate),
              description: existing.description,
            }
          : undefined,
        new_values: {
          overtime_rate: Number(updatedPolicy.overtime_rate),
          overtime_rate_kind: updatedPolicy.overtime_rate_kind,
          late_early_penalty: Number(updatedPolicy.late_early_penalty),
          late_early_penalty_kind: updatedPolicy.late_early_penalty_kind,
          absence_penalty_rate: Number(updatedPolicy.absence_penalty_rate),
          description: updatedPolicy.description,
        },
      },
    })

    return {
      id: updatedPolicy.id,
      overtime_rate: Number(updatedPolicy.overtime_rate),
      overtime_rate_kind: updatedPolicy.overtime_rate_kind,
      late_early_penalty: Number(updatedPolicy.late_early_penalty),
      late_early_penalty_kind: updatedPolicy.late_early_penalty_kind,
      absence_penalty_rate: Number(updatedPolicy.absence_penalty_rate),
      description: updatedPolicy.description || '',
    }
  })
}

export async function list(payroll_period?: string, employeeIdOrCode?: string, requester?: { id?: string; role?: string }) {
  const scope = requester ? await getEmployeeScope(requester, 'read') : {}
  if (requester && employeeIdOrCode) await assertCanAccessEmployeeDetail(requester, employeeIdOrCode)
  const records = await prisma.payrollRecord.findMany({ where: {
    ...(payroll_period ? { payroll_period } : {}),
    employee: { AND: [scope, employeeIdOrCode ? buildIdOrCodeWhere(employeeIdOrCode) : {}] },
  }, include: { employee: { include: { department: true, position: true, users: { include: { roles: true } } } } }, orderBy: { payroll_period: 'desc' } })
  const pending = records.filter(row => row.status === 'PENDING')
  if (!pending.length) return records.map(formatPayrollRecord)
  const periods = pending.map(row => row.payroll_period).sort()
  const ids = [...new Set(pending.map(row => row.employeeId))]
  const dateRange = { gte: validatePeriod(periods[0]).start, lt: validatePeriod(periods.at(-1)!).end }
  const [summaries, adjustments] = await Promise.all([
    prisma.daily_attendance_summary.findMany({ where: { employee_id: { in: ids }, work_date: dateRange } }),
    prisma.attendanceAdjustment.findMany({ where: { employee_id: { in: ids }, work_date: dateRange } }),
  ])
  return records.map(row => {
    if (row.status !== 'PENDING') return formatPayrollRecord(row)
    const source = summaries.filter(s => s.employee_id === row.employeeId && s.work_date.toISOString().slice(0, 7) === row.payroll_period)
    const items = adjustments.filter(a => a.employee_id === row.employeeId && a.work_date.toISOString().slice(0, 7) === row.payroll_period)
    const details = (row.calculation_details || {}) as Record<string, any>
    const overrides = payrollOverrides(row)
    const requires_reconciliation = requiresHoursReconciliation(overrides.fields, overrides.legacy, workingHoursFingerprint(source))
    const needs_recalculation = details.source_fingerprint !== summaryFingerprint(source) || details.adjustment_fingerprint !== adjustmentFingerprint(items)
      || !overrides.fields.hourly_rate && Number(row.hourly_rate) !== monthlyHourlyRate(row.employee, row.payroll_period, row.hourly_rate)
    return formatPayrollRecord({ ...row, calculation_details: { ...details, requires_reconciliation, needs_recalculation } })
  })
}

export async function updateItem(
  idOrPayrollId: string,
  updates: {
    hourly_rate?: number; allowance?: number; total_working_hours?: number; working_hours?: number;
    total_overtime?: number; total_late_early?: number; net_salary?: number; status?: PayrollStatus;
    reason?: string; reconcile_working_hours?: boolean; reset_working_hours?: boolean; updated_at?: string;
  },
  actorUser?: { id?: string; role?: string },
) {
  const prMatch = idOrPayrollId.match(/^PR-(\d{4})(\d{2})-(\d+)$/i)
  const id = prMatch?.[3] || idOrPayrollId
  if (!/^\d+$/.test(id)) throw AppError.notFound('Payroll record not found')
  const record = await prisma.payrollRecord.findUnique({ where: { id: BigInt(id) }, include: {
    employee: { include: { department: true, position: true, users: { include: { roles: true } } } },
  } })
  if (!record || prMatch && record.payroll_period !== `${prMatch[1]}-${prMatch[2]}`) throw AppError.notFound('Payroll record not found')
  if (actorUser?.role !== 'ADMIN') await assertCanManageEmployee(actorUser, record.employeeId)
  if (['FINALIZED', 'CONFIRMED', 'PAID'].includes(record.status)) throw AppError.conflict('Kỳ lương đã khóa; cần mở khóa trước khi sửa')
  if (updates.reconcile_working_hours && updates.reset_working_hours) throw AppError.badRequest('Chỉ chọn đối chiếu hoặc đặt lại giờ công')
  const reconciling = Boolean(updates.reconcile_working_hours || updates.reset_working_hours)
  const hoursInput = updates.total_working_hours ?? updates.working_hours
  const changedHours = hoursInput !== undefined && roundHours(hoursInput * 3600) !== Number(record.total_working_hours)
  const changedRate = updates.hourly_rate !== undefined && updates.hourly_rate !== Number(record.hourly_rate)
  const changedAllowance = updates.allowance !== undefined && updates.allowance !== Number(record.allowance)
  if ((changedHours || changedRate || changedAllowance || reconciling) && !updates.reason?.trim()) throw AppError.badRequest('Cần lý do điều chỉnh hoặc đối chiếu phiếu lương')
  if (updates.reconcile_working_hours && hoursInput === undefined) throw AppError.badRequest('Cần số giờ công khi xác nhận đối chiếu')
  if (updates.status && updates.status !== record.status) throw AppError.badRequest('Dùng thao tác chốt/mở khóa kỳ để đổi trạng thái')
  if (updates.total_overtime !== undefined && updates.total_overtime !== Number(record.total_overtime) || updates.total_late_early !== undefined && updates.total_late_early !== Number(record.total_late_early)) throw AppError.badRequest('Duyệt từng khoản OT/phạt theo ngày, không sửa tổng kỳ')
  const bounds = validatePeriod(record.payroll_period)
  if (changedHours || reconciling) await aggregateDailyAttendance(bounds.month, bounds.year, record.employeeId)
  const updated = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${record.payroll_period}`}))`
    await assertCanManageEmployee(actorUser, record.employeeId, tx)
    const fresh = await tx.payrollRecord.findUniqueOrThrow({ where: { id: record.id } })
    if (+fresh.updated_at !== +record.updated_at || updates.updated_at && updates.updated_at !== fresh.updated_at.toISOString()) throw AppError.conflict('Phiếu lương vừa thay đổi; tải lại trước khi sửa')
    if (['FINALIZED', 'CONFIRMED', 'PAID'].includes(fresh.status)) throw AppError.conflict('Kỳ lương đã khóa')
    const source = await tx.daily_attendance_summary.findMany({ where: { employee_id: record.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
    const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: record.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
    const oldDetails = (fresh.calculation_details || {}) as Record<string, any>
    if (oldDetails.adjustment_fingerprint !== adjustmentFingerprint(adjustments)) throw AppError.conflict('Các khoản OT/phạt đã thay đổi; tính lại lương trước khi chỉnh phiếu')
    const sourceFingerprint = summaryFingerprint(source)
    if ((changedHours || changedRate) && !reconciling && oldDetails.source_fingerprint !== sourceFingerprint) throw AppError.conflict('Công đã thay đổi; tính lại lương trước khi điều chỉnh')
    const basis = workingHoursFingerprint(source)
    const overrides = payrollOverrides(fresh)
    if (overrides.legacy && reconciling && updates.hourly_rate === undefined) throw AppError.badRequest('Phiếu chỉnh tay cũ cần xác nhận cả lương giờ khi đối chiếu')
    if (overrides.fields.working_hours && requiresHoursReconciliation(overrides.fields, overrides.legacy, basis) && changedHours && !reconciling) throw AppError.conflict('Công chỉnh tay cần thao tác đối chiếu rõ ràng')
    if (updates.reset_working_hours) delete overrides.fields.working_hours
    else if (changedHours || updates.reconcile_working_hours) overrides.fields.working_hours = {
      value: roundHours(hoursInput! * 3600), basis_fingerprint: basis, reason: updates.reason!.trim(),
    }
    if (changedRate || overrides.legacy && reconciling) overrides.fields.hourly_rate = { value: updates.hourly_rate!, reason: updates.reason!.trim() }
    const legacy = overrides.legacy && !reconciling
    const requires_reconciliation = requiresHoursReconciliation(overrides.fields, legacy, basis)
    const total_working_hours = overrides.fields.working_hours?.value ?? (reconciling ? source.reduce((n, row) => n + Number(row.total_working_hours), 0) : Number(fresh.total_working_hours))
    const hourly_rate = overrides.fields.hourly_rate?.value ?? Number(fresh.hourly_rate)
    const allowance = updates.allowance ?? Number(fresh.allowance)
    if (fresh.overtime_rate == null || fresh.late_penalty_rate == null || !fresh.overtime_rate_kind || !fresh.late_penalty_rate_kind) throw AppError.conflict('Phiếu thiếu snapshot đơn giá; cần tính lại và rà soát đơn vị trước khi sửa')
    const net_salary = calculateNetSalary({ hourly_rate, total_working_hours, allowance,
      total_overtime: Number(fresh.total_overtime), total_late_early: Number(fresh.total_late_early), total_absence_penalty: Number(fresh.total_absence_penalty),
      overtime_rate: Number(fresh.overtime_rate), late_early_penalty: Number(fresh.late_penalty_rate),
      overtime_rate_kind: fresh.overtime_rate_kind, late_penalty_rate_kind: fresh.late_penalty_rate_kind,
    })
    const calculation_details = { ...oldDetails, manual: false, field_overrides: overrides.fields,
      legacy_manual_unresolved: legacy, requires_reconciliation,
      hours_source_fingerprint: basis, source_working_hours: source.reduce((n, row) => n + Number(row.total_working_hours), 0),
      // An allowance edit never acknowledges attendance changes or a stale manual-hours basis.
      source_fingerprint: reconciling || changedHours ? sourceFingerprint : oldDetails.source_fingerprint,
      needs_recalculation: !reconciling && !changedHours && oldDetails.source_fingerprint !== sourceFingerprint
        || !overrides.fields.hourly_rate && Number(fresh.hourly_rate) !== monthlyHourlyRate(record.employee, record.payroll_period, fresh.hourly_rate),
      reason: updates.reason?.trim() || oldDetails.reason || 'PAYROLL_EDIT',
    }
    const result = await tx.payrollRecord.update({ where: { id: fresh.id }, data: {
      hourly_rate, total_working_hours, allowance, net_salary, calculation_details, updated_at: new Date(),
    }, include: { employee: { include: { department: true } } } })
    await tx.auditLog.create({ data: { userId: actorUser?.id, action: reconciling ? 'RECONCILE_PAYROLL_HOURS' : 'UPDATE_PAYROLL_RECORD', target_table: 'payroll_records', record_id: String(fresh.id),
      old_values: { hourly_rate: Number(fresh.hourly_rate), total_working_hours: Number(fresh.total_working_hours), allowance: Number(fresh.allowance), net_salary: Number(fresh.net_salary), field_overrides: oldDetails.field_overrides || null },
      new_values: { hourly_rate, total_working_hours, allowance, net_salary, field_overrides: overrides.fields, requires_reconciliation, reason: updates.reason || 'PAYROLL_EDIT' },
    } })
    return result
  })
  return { ...formatPayrollRecord(updated), reason: updates.reason }
}

function summaryFingerprint(rows: Array<{ id: bigint; total_working_hours: unknown; overtime: unknown; late_early: unknown; overtime_status: string; policy_version: string | null; calculation_details: unknown; requires_review: boolean }>) {
  return createHash('sha256').update(JSON.stringify([...rows].sort((a,b) => a.id < b.id ? -1 : 1).map(r => [String(r.id), String(r.total_working_hours), String(r.overtime), String(r.late_early), r.overtime_status, r.policy_version, r.requires_review, (r.calculation_details as Record<string, unknown> | null)?.fingerprint]))).digest('hex')
}

function validatePeriod(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw AppError.badRequest('Kỳ lương phải có dạng YYYY-MM hợp lệ')
  const [year, month] = period.split('-').map(Number)
  if (year < 2000 || year > 2100) throw AppError.badRequest('Năm phải từ 2000 đến 2100')
  return { year, month, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) }
}

export async function finalizePeriod(period: string, actorUserId?: string, actorRole?: string) {
  const bounds = validatePeriod(period)
  const actor = { id: actorUserId, role: actorRole }
  if (!['ADMIN', 'MANAGER'].includes(actorRole || '')) throw AppError.forbidden()

  const employeeScope = await getEmployeeScope(actor, 'manage')
  await aggregateDailyAttendance(bounds.month, bounds.year, undefined, undefined, employeeScope)
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    const currentScope = await getEmployeeScope(actor, 'manage', tx)
    const allRows = await tx.payrollRecord.findMany({ where: { payroll_period: period, employee: currentScope }, include: { employee: { include: { users: { include: { roles: true } }, department: true, position: true } } } })
    const rows = allRows.filter(row => row.status === 'PENDING')
    if (!rows.length) throw AppError.badRequest('Chưa có bảng lương thuộc quyền được chốt')
    for (const row of rows) if (actorRole !== 'ADMIN') {
      assertCannotModifySelfControlData(actor, row.employee.user_id, 'chốt lương của mình')
      assertCannotModifyOtherManager(actor, row.employee, 'chốt lương')
    }
    const lockedRows = await tx.attendance_locks.findMany({
      where: { work_date: { gte: bounds.start, lt: bounds.end }, is_locked: true },
      select: { work_date: true },
    })
    const lockedWorkDates = lockedRows.map((l: { work_date: Date }) => l.work_date)
    const pending = await tx.daily_attendance_summary.count({
      where: {
        employee_id: { in: rows.map(r => r.employeeId) },
        work_date: { gte: bounds.start, lt: bounds.end },
        OR: [
          { requires_review: true },
          { overtime_status: 'PENDING' },
          { policy_version: null },
        ],
      },
    })
    const pendingAdjustments = await tx.attendanceAdjustment.count({ where: { employee_id: { in: rows.map(r => r.employeeId) }, work_date: { gte: bounds.start, lt: bounds.end }, status: 'PENDING' } })
    if (pendingAdjustments) throw AppError.conflict('Còn khoản OT/phạt chờ duyệt trước khi chốt lương')
    if (pending) throw AppError.conflict('Còn ngày công/OT cần xác minh hoặc duyệt trước khi chốt lương')
    for (const row of rows.filter(r => r.status === 'PENDING')) {
      const source = await tx.daily_attendance_summary.findMany({ where: { employee_id: row.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
      const overrides = payrollOverrides(row)
      if (requiresHoursReconciliation(overrides.fields, overrides.legacy, workingHoursFingerprint(source))) throw AppError.conflict('Công chỉnh tay cần đối chiếu với nguồn mới trước khi chốt lương')
      if (source.some(s => !lockedWorkDates.some(date => +date === +s.work_date) && s.policy_version !== attendancePolicyVersion(s.work_date.toISOString().slice(0, 10)))) throw AppError.conflict('Cần tổng hợp lại ngày công theo chính sách đúng ngày hiệu lực')
      if (source.some(s => { const details = s.calculation_details as Record<string, unknown> | null; return details && !details.off && +new Date(String(details.scheduledEnd)) > Date.now() })) throw AppError.conflict('Còn ca chưa kết thúc, bao gồm ca qua đêm; chưa thể chốt lương')
      if (tx.employee_shifts) {
        const shifts = await tx.employee_shifts.findMany({
          where: { employee_id: row.employeeId, work_date: { gte: bounds.start, lt: bounds.end } },
          include: { work_shifts: true },
        })
        for (const s of shifts) {
          const { end: shiftEnd, off, isZeroDuration } = shiftBounds(vnDay(s.work_date), { ...s, start_time: s.start_time ?? s.work_shifts?.start_time, end_time: s.end_time ?? s.work_shifts?.end_time })
          if (!off && !isZeroDuration && +shiftEnd > Date.now()) {
            throw AppError.conflict('Còn ca chưa kết thúc, bao gồm ca qua đêm; chưa thể chốt lương')
          }
        }
      }
      const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: row.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
      if ((row.calculation_details as Record<string, unknown> | null)?.adjustment_fingerprint !== adjustmentFingerprint(adjustments)) throw AppError.conflict('Các khoản OT/phạt đã thay đổi; cần tính lại lương')
      if ((row.calculation_details as Record<string, unknown> | null)?.source_fingerprint !== summaryFingerprint(source)) throw AppError.conflict('Công/OT đã thay đổi sau lần tính lương; cần tính lại hoặc rà soát phiếu chỉnh tay trước khi chốt')
      if (!overrides.fields.hourly_rate && Number(row.hourly_rate) !== monthlyHourlyRate(row.employee, period, row.hourly_rate)) {
        throw AppError.conflict('Mức lương giờ nhân viên đã thay đổi; cần tính lại bảng lương trước khi chốt')
      }
      if (!row.overtime_rate_kind || !row.late_penalty_rate_kind) {
        throw AppError.conflict('Thiếu đơn vị đơn giá snapshot; cần tính lại bảng lương trước khi chốt')
      }
    }
    if (rows.some(r => (r.calculation_details as Record<string, unknown> | null)?.policy !== ATTENDANCE_POLICY_VERSION)) throw AppError.conflict('Cần tính lại bảng lương cũ theo chính sách đã chốt')

    // Kiểm tra độc lập ngày kết thúc kỳ: Ngày cuối cùng của tháng phải qua hết (sang ngày 1 tháng sau) mới được chốt định kỳ
    const now = new Date()
    const todayVN = vnDay(now)
    const periodEndVN = `${period}-${String(new Date(bounds.year, bounds.month, 0).getDate()).padStart(2, '0')}`
    if (todayVN <= periodEndVN) {
      throw AppError.conflict('Kỳ lương chưa kết thúc. Chỉ có thể chốt sau khi ngày làm việc cuối cùng của kỳ đã kết thúc (sang ngày 1 tháng sau) hoặc dùng quy trình quyết toán sớm.')
    }

    await tx.payrollRecord.updateMany({ where: { id: { in: rows.map(r => r.id) }, status: 'PENDING' }, data: { status: 'FINALIZED' } })
    await tx.auditLog.create({ data: { userId: actorUserId, action: 'FINALIZE_PAYROLL_PERIOD', target_table: 'payroll_records', record_id: period, new_values: { period } } })
  })
  return list(period, undefined, { id: actorUserId, role: actorRole })
}

async function settlementImpact(tx: Pick<Prisma.TransactionClient, 'attendance_logs' | 'daily_attendance_summary' | 'attendanceAdjustment' | 'employee_shifts'>, employeeId: string, cutoffDate: string, periodEnd: Date) {
  const nextDay = new Date(`${cutoffDate}T00:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const cutoffDayVN = new Date(`${cutoffDate}T00:00:00+07:00`)
  const [logs, summaries, adjustments, shifts] = await Promise.all([
    tx.attendance_logs.findMany({ where: { employee_id: employeeId, OR: [{ work_date: { gte: nextDay } }, { event_time: { gte: cutoffDayVN } }] }, select: { id: true, type: true, status: true, work_date: true, event_time: true } }),
    tx.daily_attendance_summary.findMany({ where: { employee_id: employeeId, work_date: { gte: nextDay } } }),
    tx.attendanceAdjustment.findMany({ where: { employee_id: employeeId, work_date: { gte: nextDay } } }),
    tx.employee_shifts.findMany({ where: { employee_id: employeeId, work_date: { gte: new Date(`${cutoffDate}T00:00:00Z`) } }, include: { work_shifts: true } }),
  ])
  const schedule = shifts.map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts?.start_time, end_time: s.end_time ?? s.work_shifts?.end_time }))
  const prepared = prepareAttendance(logs, schedule)
  const pairedDates = new Map(prepared.pairing.pairs.flatMap(pair => [[pair.inId, pair.workDate], [pair.outId, pair.workDate]] as [string, string][]))
  const scanDates = logs.filter(log => log.status === 'VALID').map(log => pairedDates.get(String(log.id)) ?? (log.work_date ? log.work_date.toISOString().slice(0, 10) : prepared.workDate(log.event_time))).filter(date => date > cutoffDate)
  const worked = summaries.filter(s => Number(s.total_working_hours) > 0 || Number(s.overtime) > 0 || Number(s.overtime_candidate_hours) > 0)
  const approved = adjustments.filter(a => a.status === 'APPROVED')
  const conflictDates = [...new Set([
    ...scanDates,
    ...worked.map(s => s.work_date.toISOString().slice(0, 10)),
    ...approved.map(a => a.work_date.toISOString().slice(0, 10)),
  ])].sort()
  return {
    blocked: conflictDates.length > 0,
    conflict_dates: conflictDates,
    worked_hours_after_cutoff: worked.reduce((sum, s) => sum + Number(s.total_working_hours), 0),
    approved_adjustments_after_cutoff: approved.length,
    shift_dates_after_cutoff: [...new Set(shifts.filter(s => s.work_date >= nextDay).map(s => s.work_date.toISOString().slice(0, 10)))].sort(),
    adjustments_to_remove: adjustments.filter(a => a.work_date < periodEnd).map(a => ({ date: a.work_date.toISOString().slice(0, 10), kind: a.kind, status: a.status, hours: Number(a.hours), amount: Number(a.amount) })),
  }
}

export async function previewEarlySettlement(data: EarlySettlementDto, actorUserId?: string, actorRole?: string) {
  if (!['ADMIN', 'MANAGER'].includes(actorRole || '')) throw AppError.forbidden()
  const bounds = validatePeriod(data.period)
  if (data.cutoffDate.slice(0, 7) !== data.period || data.cutoffDate > vnDay(new Date())) throw AppError.badRequest('Ngày quyết toán phải thuộc kỳ và không ở tương lai')
  const employee = await prisma.employee.findFirst({ where: buildIdOrCodeWhere(data.employeeId) })
  if (!employee) throw AppError.notFound('Không tìm thấy nhân viên')
  await assertCanManageEmployee({ id: actorUserId, role: actorRole }, employee.id)
  return settlementImpact(prisma, employee.id, data.cutoffDate, bounds.end)
}

export async function finalizeEarlySettlement(
  data: EarlySettlementDto,
  actorUserId?: string,
  actorRole?: string
) {
  const { employeeId, period, cutoffDate, reason } = data
  if (!['ADMIN', 'MANAGER'].includes(actorRole || '')) throw AppError.forbidden()
  const bounds = validatePeriod(period)
  if (cutoffDate.slice(0, 7) !== period) {
    throw AppError.badRequest('Ngày quyết toán (cutoffDate) phải thuộc kỳ lương đã chọn')
  }
  const now = new Date()
  const todayVN = vnDay(now)
  if (cutoffDate > todayVN) {
    throw AppError.badRequest('Không thể quyết toán sớm cho ngày trong tương lai')
  }

  const actor = { id: actorUserId, role: actorRole }
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(employeeId),
    include: { users: { include: { roles: true } }, department: true, position: true },
  })
  if (!emp) throw AppError.notFound('Không tìm thấy nhân viên')
  await assertCanManageEmployee(actor, emp.id)
  if (actorRole !== 'ADMIN') {
    assertCannotModifySelfControlData(actor, emp.user_id, 'quyết toán lương của mình')
    assertCannotModifyOtherManager(actor, emp, 'quyết toán lương')
  }

  // 1. Tổng hợp công từ đầu kỳ đến ngày cutoffDate
  await aggregateDailyAttendance(bounds.month, bounds.year, emp.id, undefined)
  const policy = await getBonusPenalty()

  // 2. Thực hiện transaction quyết toán sớm
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${emp.id}))`
    await assertCanManageEmployee(actor, emp.id, tx)

    const record = await tx.payrollRecord.findFirst({
      where: { payroll_period: period, employeeId: emp.id },
      include: { employee: true },
    })
    if (!record) throw AppError.notFound('Chưa tạo phiếu lương cho nhân viên trong kỳ này')
    if (['FINALIZED', 'CONFIRMED', 'PAID'].includes(record.status)) {
      throw AppError.conflict('Phiếu lương của nhân viên đã ở trạng thái chốt hoặc đã thanh toán')
    }

    const cutoffDateUtc = new Date(`${cutoffDate}T00:00:00Z`)
    const cutoffDateNextDay = new Date(+cutoffDateUtc + 86400000)

    const impact = await settlementImpact(tx, emp.id, cutoffDate, bounds.end)
    if (impact.blocked) throw AppError.conflict(`Còn công thực tế hoặc khoản đã duyệt sau ngày quyết toán: ${impact.conflict_dates.join(', ')}. Cần đối soát trước khi quyết toán.`)

    // Kiểm tra các khoản chưa duyệt hoặc ngày cần review trước cutoffDate
    const pendingSummaries = await tx.daily_attendance_summary.count({
      where: {
        employee_id: emp.id,
        work_date: { gte: bounds.start, lt: cutoffDateNextDay },
        OR: [{ requires_review: true }, { overtime_status: 'PENDING' }, { policy_version: null }],
      },
    })
    if (pendingSummaries > 0) {
      throw AppError.conflict('Còn ngày công cần xác minh hoặc OT chờ duyệt trước ngày quyết toán')
    }

    const pendingAdjustments = await tx.attendanceAdjustment.count({
      where: {
        employee_id: emp.id,
        work_date: { gte: bounds.start, lt: cutoffDateNextDay },
        status: 'PENDING',
      },
    })
    if (pendingAdjustments > 0) {
      throw AppError.conflict('Còn khoản phạt/OT chờ duyệt trước ngày quyết toán')
    }

    const shiftsBeforeCutoff = await tx.employee_shifts.findMany({
      where: { employee_id: emp.id, work_date: { gte: bounds.start, lt: cutoffDateNextDay } },
      include: { work_shifts: true },
    })
    for (const s of shiftsBeforeCutoff) {
      const { end, off, isZeroDuration } = shiftBounds(vnDay(s.work_date), { ...s, start_time: s.start_time ?? s.work_shifts?.start_time, end_time: s.end_time ?? s.work_shifts?.end_time })
      if (!off && !isZeroDuration && +end > Date.now()) throw AppError.conflict('Còn ca chưa kết thúc; chưa thể quyết toán')
    }

    const settlementSummaries = await tx.daily_attendance_summary.findMany({ where: { employee_id: emp.id, work_date: { gte: bounds.start, lt: cutoffDateNextDay } } })
    const settlementOverrides = payrollOverrides(record)
    if (requiresHoursReconciliation(settlementOverrides.fields, settlementOverrides.legacy, workingHoursFingerprint(settlementSummaries))) {
      throw AppError.conflict('Công chỉnh tay cần đối chiếu với nguồn mới trước khi chốt lương')
    }

    const removedAdjustments = await tx.attendanceAdjustment.findMany({
      where: { employee_id: emp.id, work_date: { gte: cutoffDateNextDay, lt: bounds.end } },
    })
    const tomorrow = new Date(`${todayVN}T00:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const futurePeriodStart = new Date(Math.max(+bounds.end, +tomorrow))
    const shiftsInPeriod = await tx.employee_shifts.findMany({ where: { employee_id: emp.id, work_date: { gte: cutoffDateNextDay, lt: bounds.end } } })
    const futureShifts = await tx.employee_shifts.findMany({ where: { employee_id: emp.id, work_date: { gte: futurePeriodStart } } })

    // Xóa/hủy các ca làm việc và tổng hợp tương lai sau cutoffDate của nhân viên này để không phát sinh vắng ảo
    if (tx.employee_shifts) {
      await tx.employee_shifts.deleteMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: cutoffDateNextDay, lt: bounds.end },
        },
      })
      await tx.employee_shifts.deleteMany({ where: { employee_id: emp.id, work_date: { gte: futurePeriodStart } } })
    }
    if (tx.daily_attendance_summary) {
      await tx.daily_attendance_summary.deleteMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: cutoffDateNextDay, lt: bounds.end },
        },
      })
    }
    if (tx.attendanceAdjustment) {
      await tx.attendanceAdjustment.deleteMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: cutoffDateNextDay, lt: bounds.end },
        },
      })
    }

    // Gọi lại logic tính toán của generate cho riêng nhân viên đó trong cùng transaction đến cutoffDate
    const summaries = settlementSummaries
    const adjustments = await tx.attendanceAdjustment.findMany({
      where: { employee_id: emp.id, work_date: { gte: bounds.start, lt: cutoffDateNextDay } },
    })
    const approved = adjustments.filter(a => a.status === 'APPROVED')
    const overrides = payrollOverrides(record)
    const basis = workingHoursFingerprint(summaries)
    const requires_reconciliation = requiresHoursReconciliation(overrides.fields, overrides.legacy, basis)
    const source_working_hours = summaries.reduce((n, row) => n + Number(row.total_working_hours), 0)
    const total_working_hours = overrides.fields.working_hours?.value ?? source_working_hours
    const total_late_early = approved.filter(a => a.kind === 'LATE_EARLY').reduce((n, a) => n + Number(a.hours), 0)
    const total_overtime = approved.filter(a => a.kind === 'OVERTIME').reduce((n, a) => n + Number(a.hours), 0)
    const total_absence_penalty = approved.filter(a => a.kind === 'ABSENCE').reduce((n, a) => n + Number(a.amount), 0)
    const hourly_rate = overrides.fields.hourly_rate?.value ?? monthlyHourlyRate(record.employee, period, record.hourly_rate)
    const allowance = Number(record.allowance ?? 1500000)
    const overtime_rate = Number(record.overtime_rate ?? policy.overtime_rate)
    const late_penalty_rate = Number(record.late_penalty_rate ?? policy.late_early_penalty)
    const overtime_rate_kind = record.overtime_rate_kind || policy.overtime_rate_kind || 'FIXED_PER_HOUR'
    const late_penalty_rate_kind = record.late_penalty_rate_kind || policy.late_early_penalty_kind || 'FIXED_PER_HOUR'

    const net_salary = calculateNetSalary({
      hourly_rate,
      total_working_hours,
      total_overtime,
      total_late_early,
      allowance,
      overtime_rate,
      late_early_penalty: late_penalty_rate,
      total_absence_penalty,
      overtime_rate_kind,
      late_penalty_rate_kind,
    })

    // Cập nhật phiếu lương sang FINALIZED kèm thông tin quyết toán sớm và các số liệu tính toán lại
    const existingDetails = (record.calculation_details as Record<string, unknown> | null) || {}
    const updated = await tx.payrollRecord.update({
      where: { id: record.id },
      data: {
        hourly_rate,
        total_working_hours,
        total_overtime,
        total_late_early,
        total_absence_penalty,
        allowance,
        net_salary,
        overtime_rate,
        late_penalty_rate,
        overtime_rate_kind,
        late_penalty_rate_kind,
        status: 'FINALIZED',
        calculation_details: {
          ...existingDetails,
          manual: false,
          field_overrides: overrides.fields,
          legacy_manual_unresolved: overrides.legacy,
          requires_reconciliation,
          source_working_hours,
          hours_source_fingerprint: basis,
          source_fingerprint: summaryFingerprint(summaries),
          adjustment_fingerprint: adjustmentFingerprint(adjustments),
          early_settlement: {
            is_early_settlement: true,
            cutoff_date: cutoffDate,
            reason: reason.trim(),
            finalized_by: actorUserId,
            finalized_at: now.toISOString(),
          },
        },
      },
    })

    const previousEmployeeStatus = record.employee.status
    await tx.employee.update({ where: { id: emp.id }, data: { status: 'TERMINATED' } })

    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'FINALIZE_EARLY_SETTLEMENT',
        target_table: 'payroll_records',
        record_id: String(record.id),
        old_values: { employee_status: previousEmployeeStatus, removed_adjustments: JSON.parse(JSON.stringify(removedAdjustments, (_key, value) => typeof value === 'bigint' ? String(value) : value)), removed_shifts: JSON.parse(JSON.stringify([...shiftsInPeriod, ...futureShifts], (_key, value) => typeof value === 'bigint' ? String(value) : value)) },
        new_values: {
          employeeId: emp.id,
          period,
          cutoffDate,
          total_working_hours,
          net_salary,
          reason: reason.trim(),
          employee_status: 'TERMINATED',
        },
      },
    })

    return updated
  })
}

export async function unlockPeriod(period: string, actorUserId?: string) {
  validatePeriod(period)
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    const rows = await tx.payrollRecord.findMany({ where: { payroll_period: period } })
    const eligible = rows.filter(row => !(row.calculation_details as Record<string, any> | null)?.early_settlement?.is_early_settlement)
    if (eligible.some(row => row.status === 'PAID')) throw AppError.conflict('Kỳ đã trả cần quy trình điều chỉnh riêng, không được ghi đè')
    await tx.payrollRecord.updateMany({ where: { id: { in: eligible.map(row => row.id) } }, data: { status: 'PENDING' } })
    await tx.auditLog.create({ data: { userId: actorUserId, action: 'UNLOCK_PAYROLL_PERIOD', target_table: 'payroll_records', record_id: period, new_values: { period } } })
  })
  return list(period)
}

export async function generate(payroll_period: string, employeeId?: string, actorUserId?: string, actorUser?: { id?: string; role?: string }) {
  const { year, month, start, end } = validatePeriod(payroll_period)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  if (payroll_period > today.slice(0, 7)) throw AppError.badRequest('Không tính lương cho kỳ tương lai')
  if (!actorUser || !['ADMIN', 'MANAGER'].includes(actorUser.role || '')) throw AppError.forbidden()
  const employeeScope = await getEmployeeScope(actorUser, 'manage')
  if (employeeId) await assertCanManageEmployee(actorUser, employeeId)
  await aggregateDailyAttendance(month, year, employeeId, undefined, employeeScope)
  const policy = await getBonusPenalty()
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${payroll_period}`}))`
    const currentScope = await getEmployeeScope(actorUser, 'manage', tx)
    if (employeeId) await assertCanManageEmployee(actorUser, employeeId, tx)
    const employees = await tx.employee.findMany({ where: { AND: [currentScope, employeeId ? buildIdOrCodeWhere(employeeId) : {
      OR: [{ status: 'ACTIVE' }, { daily_attendance_summary: { some: { work_date: { gte: start, lt: end } } } }],
    }] }, include: { department: true, position: true, users: { include: { roles: true } } } })
    const results = []
    for (const emp of employees) {
      const existing = await tx.payrollRecord.findUnique({ where: { employeeId_payroll_period: { employeeId: emp.id, payroll_period } } })
      if (existing && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(existing.status)) {
        if (employeeId) throw AppError.conflict('Kỳ lương đã khóa/đã trả')
        continue
      }
      const summaries = await tx.daily_attendance_summary.findMany({ where: { employee_id: emp.id,
        work_date: { gte: start, lt: end, lte: new Date(`${today}T00:00:00Z`) } } })
      const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: emp.id, work_date: { gte: start, lt: end } } })
      const approved = adjustments.filter(a => a.status === 'APPROVED')
      const overrides = payrollOverrides(existing)
      const basis = workingHoursFingerprint(summaries)
      const requires_reconciliation = requiresHoursReconciliation(overrides.fields, overrides.legacy, basis)
      const source_working_hours = summaries.reduce((n, row) => n + Number(row.total_working_hours), 0)
      const total_working_hours = overrides.fields.working_hours?.value ?? source_working_hours
      const total_late_early = approved.filter(a => a.kind === 'LATE_EARLY').reduce((n, a) => n + Number(a.hours), 0)
      const total_overtime = approved.filter(a => a.kind === 'OVERTIME').reduce((n, a) => n + Number(a.hours), 0)
      const total_absence_penalty = approved.filter(a => a.kind === 'ABSENCE').reduce((n, a) => n + Number(a.amount), 0)
      const hourly_rate = overrides.fields.hourly_rate?.value ?? monthlyHourlyRate(emp, payroll_period, existing?.hourly_rate)
      const allowance = existing ? Number(existing.allowance) : 1500000
      const overtime_rate = Number(existing?.overtime_rate ?? policy.overtime_rate)
      const late_penalty_rate = Number(existing?.late_penalty_rate ?? policy.late_early_penalty)
      const overtime_rate_kind = existing?.overtime_rate != null ? existing.overtime_rate_kind : policy.overtime_rate_kind
      const late_penalty_rate_kind = existing?.late_penalty_rate != null ? existing.late_penalty_rate_kind : policy.late_early_penalty_kind
      if (!overtime_rate_kind || !late_penalty_rate_kind) throw AppError.conflict('Snapshot đơn giá cũ chưa rõ đơn vị; cần chuyển đổi dữ liệu trước khi tính lại')
      const net_salary = calculateNetSalary({ hourly_rate, total_working_hours, total_overtime, total_late_early, allowance,
        overtime_rate, late_early_penalty: late_penalty_rate, total_absence_penalty, overtime_rate_kind, late_penalty_rate_kind })
      const data = { hourly_rate, total_working_hours, total_overtime, total_late_early, total_absence_penalty, allowance, net_salary,
        overtime_rate, late_penalty_rate, overtime_rate_kind, late_penalty_rate_kind, status: 'PENDING', calculation_details: {
          manual: false, field_overrides: overrides.fields, legacy_manual_unresolved: overrides.legacy, requires_reconciliation,
          source_working_hours, hours_source_fingerprint: basis, needs_recalculation: false,
          reason: (existing?.calculation_details as Record<string, any> | null)?.reason ?? null,
          policy: ATTENDANCE_POLICY_VERSION, policy_id: policy.id, generated_at: new Date().toISOString(),
          source_fingerprint: summaryFingerprint(summaries), adjustment_fingerprint: adjustmentFingerprint(adjustments),
          adjustment_ids: approved.map(a => String(a.id)), summary_ids: summaries.map(s => String(s.id)),
          overtime_rate, late_penalty_rate, overtime_rate_kind, late_penalty_rate_kind,
          pending_review_days: summaries.filter(s => s.requires_review || s.overtime_status === 'PENDING').map(s => s.work_date.toISOString().slice(0, 10)),
        } }
      results.push(await tx.payrollRecord.upsert({ where: { employeeId_payroll_period: { employeeId: emp.id, payroll_period } },
        update: data, create: { employeeId: emp.id, payroll_period, ...data }, include: { employee: { include: { department: true } } } }))
    }
    await tx.auditLog.create({ data: { userId: actorUserId, action: 'GENERATE_PAYROLL', target_table: 'payroll_records', record_id: payroll_period,
      new_values: { employee_count: results.length, employeeId: employeeId || 'ALL' } } })
    return results.map(formatPayrollRecord)
  }, { timeout: 30000, maxWait: 10000 })
}
