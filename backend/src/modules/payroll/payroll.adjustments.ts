import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { assertCanAccessEmployeeDetail, assertCannotModifyOtherManager, assertCannotModifySelfControlData, isEmployeeManager } from '../employees/index.js'
import { aggregateDailyAttendance, assertEditableDay } from '../attendance/attendance.service.js'
import { emitAttendanceEvent } from '../attendance/attendance.gateway.js'
import { getEmployeeScope, assertCanManageEmployee } from '../employees/employee.permission.js'
import { monthlyHourlyRate } from '../employees/employee.wage.js'
import { payrollOverrides } from './payroll.overrides.js'
import { policyForPeriod, validMultiplier } from '../../common/payroll-policy.js'
import { historicalAdjustmentAmount } from '../../common/payroll-history.js'

type Actor = { id?: string; role?: string }
const bounds = (period: string) => {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(period)) throw AppError.badRequest('Kỳ phải có dạng YYYY-MM')
  const [y,m] = period.split('-').map(Number)
  return { start: new Date(Date.UTC(y,m-1,1)), end: new Date(Date.UTC(y,m,1)), y, m }
}

export async function listAdjustments(period: string, employeeId: string | undefined, actor: Actor) {
  const { start, end } = bounds(period)
  const where: Prisma.AttendanceAdjustmentWhereInput = { work_date: { gte: start, lt: end } }
  const employeeScope = await getEmployeeScope(actor, 'read')
  if (employeeId) {
    await assertCanAccessEmployeeDetail(actor, employeeId)
    where.employee = buildIdOrCodeWhere(employeeId)
  }
  where.AND = [{ employee: employeeScope }]
  const [rows, policy, payroll, locks] = await Promise.all([
    prisma.attendanceAdjustment.findMany({ where, include: { employee: { include: { position: true, users: { include: { roles: true } } } } }, orderBy: [{ work_date: 'asc' }, { kind: 'asc' }] }),
    policyForPeriod(period),
    prisma.payrollRecord.findMany({ where: { payroll_period: period, employee: employeeScope }, select: { employeeId: true, hourly_rate: true, total_working_hours: true, calculation_details: true, overtime_rate: true, late_penalty_rate: true, status: true } }),
    prisma.attendance_locks.findMany({ where: { work_date: { gte: start, lt: end }, is_locked: true }, select: { work_date: true } }),
  ])
  return rows.filter(row => actor.role !== 'MANAGER' || row.employee.user_id === actor.id || !isEmployeeManager(row.employee)).map(row => {
    const snapshot = payroll.find(p => p.employeeId === row.employee_id)
    const locked = Boolean(snapshot && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(snapshot.status) || locks.some(l => +l.work_date === +row.work_date))
    const isFinalized = Boolean(snapshot && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(snapshot.status))
    const snapshotStatus = (snapshot?.calculation_details as Record<string, unknown> | null)?.rate_snapshot_status
    const unresolved = ['UNRESOLVED', 'LEGACY_VERIFIED'].includes(String(snapshotStatus))
    const hourlyRate = snapshot && (isFinalized || payrollOverrides(snapshot).fields.hourly_rate)
      ? Number(snapshot.hourly_rate)
      : monthlyHourlyRate(row.employee, period, snapshot?.hourly_rate)
    const rateValue = row.kind === 'OVERTIME'
      ? (validMultiplier(snapshot?.overtime_rate) && !unresolved ? Number(snapshot!.overtime_rate) : (isFinalized || unresolved ? null : policy?.overtime_rate ?? null))
      : (validMultiplier(snapshot?.late_penalty_rate) && !unresolved ? Number(snapshot!.late_penalty_rate) : (isFinalized || unresolved ? null : policy?.late_early_penalty ?? null))
    const legacyAmount = snapshot ? historicalAdjustmentAmount(snapshot, row.kind, Number(row.hours), hourlyRate) : null
    const amount = row.kind === 'ABSENCE' ? Number(row.amount) : legacyAmount != null ? Math.round(legacyAmount) : rateValue == null ? null : Math.round(Number(row.hours) * rateValue * hourlyRate)
    return { id: String(row.id), employee_id: row.employee.employee_code, employee_name: row.employee.full_name,
      date: row.work_date.toISOString().slice(0,10), kind: row.kind, hours: Number(row.hours),
      amount, amount_unavailable: amount == null,
      status: row.status, note: row.note, reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at,
      updated_at: row.updated_at.toISOString(), source_details: row.source_details,
      locked,
      can_review: !locked && amount != null && ['ADMIN','MANAGER'].includes(actor.role || '') && (actor.role === 'ADMIN' || row.employee.user_id !== actor.id),
    }
  })
}

export async function reviewAdjustment(id: string, data: { status: 'APPROVED' | 'REJECTED'; note?: string; updated_at: string }, actor: Actor) {
  if (!['ADMIN', 'MANAGER'].includes(actor.role || '')) throw AppError.forbidden()
  const item = await prisma.attendanceAdjustment.findUnique({ where: { id: BigInt(id) }, include: { employee: { include: { position: true, users: { include: { roles: true } } } } } })
  if (!item) throw AppError.notFound('Không tìm thấy khoản OT/phạt')
  await assertCanManageEmployee(actor, item.employee_id)
  assertCannotModifySelfControlData(actor, item.employee.user_id, 'duyệt OT/phạt')
  assertCannotModifyOtherManager(actor, item.employee, 'duyệt OT/phạt')
  const date = item.work_date.toISOString().slice(0,10)
  const { y, m } = bounds(date.slice(0,7))
  // Refresh durable scan/shift changes before deciding; stale clients must reload.
  await aggregateDailyAttendance(m, y, item.employee_id, date)
  await prisma.$transaction(async tx => {
    await assertEditableDay(tx, date, item.employee_id)
    await assertCanManageEmployee(actor, item.employee_id, tx)
    const fresh = await tx.attendanceAdjustment.findUniqueOrThrow({ where: { id: item.id } })
    if (fresh.updated_at.toISOString() !== data.updated_at) throw AppError.conflict('Khoản duyệt đã thay đổi; tải lại trước khi duyệt')
    if (fresh.status === 'VOID') throw AppError.conflict('Khoản này không còn phát sinh')
    if (data.status === 'APPROVED') {
      const [employee, snapshot, policy] = await Promise.all([
        tx.employee.findUniqueOrThrow({ where: { id: item.employee_id } }),
        tx.payrollRecord.findUnique({ where: { employeeId_payroll_period: { employeeId: item.employee_id, payroll_period: date.slice(0, 7) } } }),
        policyForPeriod(date.slice(0, 7), tx),
      ])
      const snapshotStatus = (snapshot?.calculation_details as Record<string, unknown> | null)?.rate_snapshot_status
      const unresolved = ['UNRESOLVED', 'LEGACY_VERIFIED'].includes(String(snapshotStatus))
      const savedRate = snapshot && payrollOverrides(snapshot).fields.hourly_rate ? snapshot.hourly_rate : undefined
      const hourlyRate = employee.hourly_rate == null && !snapshot ? NaN : monthlyHourlyRate(employee, date.slice(0, 7), savedRate ?? snapshot?.hourly_rate)
      const multiplier = fresh.kind === 'OVERTIME' ? snapshot?.overtime_rate : snapshot?.late_penalty_rate
      const policyRate = fresh.kind === 'OVERTIME' ? policy?.overtime_rate : policy?.late_early_penalty
      const source = fresh.source_details as Record<string, unknown> | null
      const absenceRate = source?.absence_penalty_rate
      const absenceHourly = source?.hourly_rate
      const absenceValid = fresh.amount != null && absenceHourly != null && Number.isFinite(Number(absenceHourly)) && Number(absenceHourly) >= 0 && validMultiplier(absenceRate)
        && Math.round(Number(fresh.hours) * Number(absenceHourly) * Number(absenceRate)) === Number(fresh.amount)
      if (unresolved || !Number.isFinite(hourlyRate) || hourlyRate < 0 || (fresh.kind !== 'ABSENCE' && !validMultiplier(multiplier ?? policyRate)) || (fresh.kind === 'ABSENCE' && !absenceValid)) {
        throw AppError.conflict('Chưa xác định đầy đủ đơn giá và chính sách để duyệt khoản này')
      }
    }
    const note = data.note?.trim() || null
    const updated = await tx.attendanceAdjustment.update({ where: { id: item.id }, data: { status: data.status, note, reviewed_by: actor.id, reviewed_at: new Date() } })
    if (item.kind === 'OVERTIME') await tx.daily_attendance_summary.update({ where: { employee_id_work_date: { employee_id: item.employee_id, work_date: item.work_date } }, data: {
      overtime: data.status === 'APPROVED' ? fresh.hours : 0, overtime_status: data.status,
      overtime_reason: note, approved_by: actor.id, approved_at: new Date(),
    } })
    await tx.auditLog.create({ data: { userId: actor.id, action: 'REVIEW_ATTENDANCE_ADJUSTMENT', target_table: 'attendance_adjustments', record_id: id,
      old_values: { status: fresh.status, note: fresh.note }, new_values: { status: updated.status, note, date, kind: item.kind } } })
  })
  emitAttendanceEvent('attendance-summary-updated', { employee_id: item.employee.employee_code, employee_user_id: item.employee.user_id, dates: [date] })
  return { id, status: data.status }
}
