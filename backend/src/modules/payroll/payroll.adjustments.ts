import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { assertCanAccessEmployeeDetail, assertCannotModifyOtherManager, assertCannotModifySelfControlData, isEmployeeManager } from '../employees/index.js'
import { aggregateDailyAttendance, assertEditableDay } from '../attendance/attendance.service.js'
import { emitAttendanceEvent } from '../attendance/attendance.gateway.js'

type Actor = { id?: string; role?: string }
const bounds = (period: string) => {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(period)) throw AppError.badRequest('Kỳ phải có dạng YYYY-MM')
  const [y,m] = period.split('-').map(Number)
  return { start: new Date(Date.UTC(y,m-1,1)), end: new Date(Date.UTC(y,m,1)), y, m }
}

export async function listAdjustments(period: string, employeeId: string | undefined, actor: Actor) {
  const { start, end } = bounds(period)
  const where: Prisma.AttendanceAdjustmentWhereInput = { work_date: { gte: start, lt: end } }
  if (employeeId) {
    await assertCanAccessEmployeeDetail(actor, employeeId)
    where.employee = buildIdOrCodeWhere(employeeId)
  }
  if (actor.role === 'EMPLOYEE') where.employee = { user_id: actor.id }
  if (actor.role === 'MANAGER') {
    const manager = await prisma.employee.findFirst({ where: { user_id: actor.id } })
    if (!manager?.departmentId) throw AppError.forbidden('Quản lý chưa được phân phòng ban')
    where.AND = [{ employee: { departmentId: manager.departmentId } }]
  }
  const [rows, policy, payroll, locks] = await Promise.all([
    prisma.attendanceAdjustment.findMany({ where, include: { employee: { include: { position: true, users: { include: { roles: true } } } } }, orderBy: [{ work_date: 'asc' }, { kind: 'asc' }] }),
    prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } }),
    prisma.payrollRecord.findMany({ where: { payroll_period: period }, select: { employeeId: true, hourly_rate: true, overtime_rate: true, late_penalty_rate: true, status: true } }),
    prisma.attendance_locks.findMany({ where: { work_date: { gte: start, lt: end }, is_locked: true }, select: { work_date: true } }),
  ])
  return rows.filter(row => actor.role !== 'MANAGER' || row.employee.user_id === actor.id || !isEmployeeManager(row.employee)).map(row => {
    const snapshot = payroll.find(p => p.employeeId === row.employee_id)
    const locked = Boolean(snapshot && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(snapshot.status) || locks.some(l => +l.work_date === +row.work_date))
    const hourlyRate = Number(snapshot?.hourly_rate ?? row.employee.hourly_rate ?? 0)
    const rate = Number(row.kind === 'OVERTIME' ? snapshot?.overtime_rate ?? policy?.overtime_rate ?? 100000 : snapshot?.late_penalty_rate ?? policy?.late_early_penalty ?? 50000)
    return { id: String(row.id), employee_id: row.employee.employee_code, employee_name: row.employee.full_name,
      date: row.work_date.toISOString().slice(0,10), kind: row.kind, hours: Number(row.hours),
      amount: row.kind === 'ABSENCE' ? Number(row.amount) : Math.round(Number(row.hours) * (rate <= 10 ? rate * hourlyRate : rate)),
      status: row.status, note: row.note, reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at,
      updated_at: row.updated_at.toISOString(), source_details: row.source_details,
      locked,
      can_review: !locked && ['ADMIN','MANAGER'].includes(actor.role || '') && (actor.role === 'ADMIN' || row.employee.user_id !== actor.id),
    }
  })
}

export async function reviewAdjustment(id: string, data: { status: 'APPROVED' | 'REJECTED'; note?: string; updated_at: string }, actor: Actor) {
  if (!['ADMIN', 'MANAGER'].includes(actor.role || '')) throw AppError.forbidden()
  const item = await prisma.attendanceAdjustment.findUnique({ where: { id: BigInt(id) }, include: { employee: { include: { position: true, users: { include: { roles: true } } } } } })
  if (!item) throw AppError.notFound('Không tìm thấy khoản OT/phạt')
  await assertCanAccessEmployeeDetail(actor, item.employee_id)
  if (actor.role === 'MANAGER') {
    const manager = await prisma.employee.findFirst({ where: { user_id: actor.id } })
    if (!manager?.departmentId || manager.departmentId !== item.employee.departmentId) throw AppError.forbidden('Chỉ được duyệt nhân viên phòng ban mình phụ trách')
  }
  assertCannotModifySelfControlData(actor, item.employee.user_id, 'duyệt OT/phạt')
  assertCannotModifyOtherManager(actor, item.employee, 'duyệt OT/phạt')
  const date = item.work_date.toISOString().slice(0,10)
  const { y, m } = bounds(date.slice(0,7))
  // Refresh durable scan/shift changes before deciding; stale clients must reload.
  await aggregateDailyAttendance(m, y, item.employee_id, date)
  await prisma.$transaction(async tx => {
    await assertEditableDay(tx, date, item.employee_id)
    const fresh = await tx.attendanceAdjustment.findUniqueOrThrow({ where: { id: item.id } })
    if (fresh.updated_at.toISOString() !== data.updated_at) throw AppError.conflict('Khoản duyệt đã thay đổi; tải lại trước khi duyệt')
    if (fresh.status === 'VOID') throw AppError.conflict('Khoản này không còn phát sinh')
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
