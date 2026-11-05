import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import {
  assertCanAccessEmployeeDetail,
  assertCannotModifyOtherManager,
  assertCannotModifySelfControlData,
  isEmployeeManager,
  getEmployeeScope,
  assertCanManageEmployee,
  monthlyHourlyRate,
} from '../employees/public.js'
import { payrollOverrides } from './payroll.overrides.js'
import { findAttendanceAdjustmentsWithScope, findAttendanceLocks } from '../attendance/public.js'
import { policyForPeriod, validMultiplier } from '../../common/payroll-policy.js'
import { historicalAdjustmentAmount } from '../../common/payroll-history.js'

type Actor = { id?: string; role?: string }
const bounds = (period: string) => {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(period)) throw AppError.badRequest('Kỳ phải có dạng YYYY-MM')
  const [y,m] = period.split('-').map(Number)
  return { start: new Date(Date.UTC(y,m-1,1)), end: new Date(Date.UTC(y,m,1)), y, m }
}

export async function listAdjustments(period: string, employeeId: string | undefined, actor: Actor) {
  if (period === 'ALL') {
    if (!employeeId) throw AppError.badRequest('Cần chọn nhân viên để xem tất cả các kỳ')
    await assertCanAccessEmployeeDetail(actor, employeeId)
    const employeeScope = await getEmployeeScope(actor, 'read')
    const rows = await findAttendanceAdjustmentsWithScope({ employee: buildIdOrCodeWhere(employeeId), AND: [{ employee: employeeScope }] })
    const periods = [...new Set(rows.map(row => row.work_date.toISOString().slice(0, 7)))]
    return (await Promise.all(periods.map(p => listPeriodAdjustments(p, employeeId, actor)))).flat()
  }
  return listPeriodAdjustments(period, employeeId, actor)
}

async function listPeriodAdjustments(period: string, employeeId: string | undefined, actor: Actor) {
  const { start, end } = bounds(period)
  const where: Prisma.AttendanceAdjustmentWhereInput = { work_date: { gte: start, lt: end } }
  const employeeScope = await getEmployeeScope(actor, 'read')
  if (employeeId) {
    await assertCanAccessEmployeeDetail(actor, employeeId)
    where.employee = buildIdOrCodeWhere(employeeId)
  }
  where.AND = [{ employee: employeeScope }]
  const [rows, policy, payroll, locks] = await Promise.all([
    findAttendanceAdjustmentsWithScope(where),
    policyForPeriod(period),
    prisma.payrollRecord.findMany({ where: { payroll_period: period, employee: employeeScope }, select: { employeeId: true, hourly_rate: true, total_working_hours: true, calculation_details: true, overtime_rate: true, late_penalty_rate: true, status: true } }),
    findAttendanceLocks({ workDate: { gte: start, lt: end }, isLocked: true }),
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
      can_review: false,
    }
  })
}

export async function reviewAdjustment(_id: string, _data: { status: 'APPROVED' | 'REJECTED'; note?: string; updated_at: string }, _actor: Actor) {
  throw AppError.badRequest('Hệ thống đã bỏ quy trình duyệt khoản độc lập. Các khoản OT/phạt được tự động phê duyệt đồng bộ khi ngày công được duyệt (review_status = APPROVED) trên bảng chấm công.')
}

