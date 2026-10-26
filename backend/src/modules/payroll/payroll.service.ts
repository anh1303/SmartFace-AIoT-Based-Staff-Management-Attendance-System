import { adjustmentFingerprint } from '../attendance/attendance.adjustments.js'
import { roundHours, ATTENDANCE_POLICY_VERSION } from '../attendance/attendance.policy.js'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, calculateNetSalary } from '../../common/utils.js'
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
      late_early_penalty: 50000,
      absence_penalty_rate: 0.25,
      description: 'Chính sách áp dụng chuẩn: OT 100.000 ₫/h, phạt trễ/sớm 50.000 ₫/h',
    }
  }
  return {
    id: policy.id,
    overtime_rate: Number(policy.overtime_rate),
    late_early_penalty: Number(policy.late_early_penalty),
    absence_penalty_rate: Number(policy.absence_penalty_rate),
    description: policy.description || 'Chính sách áp dụng chuẩn từ hệ thống',
  }
}

export async function updateBonusPenalty(data: {
  overtime_rate?: number
  late_early_penalty?: number
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
          ...(data.late_early_penalty !== undefined ? { late_early_penalty: data.late_early_penalty } : {}),
          ...(data.absence_penalty_rate !== undefined ? { absence_penalty_rate: data.absence_penalty_rate } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updated_at: new Date(),
        },
      })
    } else {
      updatedPolicy = await tx.bonusPenalty.create({
        data: {
          overtime_rate: data.overtime_rate ?? 100000,
          late_early_penalty: data.late_early_penalty ?? 50000,
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
              late_early_penalty: Number(existing.late_early_penalty),
              absence_penalty_rate: Number(existing.absence_penalty_rate),
              description: existing.description,
            }
          : undefined,
        new_values: {
          overtime_rate: Number(updatedPolicy.overtime_rate),
          late_early_penalty: Number(updatedPolicy.late_early_penalty),
          absence_penalty_rate: Number(updatedPolicy.absence_penalty_rate),
          description: updatedPolicy.description,
        },
      },
    })

    return {
      id: updatedPolicy.id,
      overtime_rate: Number(updatedPolicy.overtime_rate),
      late_early_penalty: Number(updatedPolicy.late_early_penalty),
      absence_penalty_rate: Number(updatedPolicy.absence_penalty_rate),
      description: updatedPolicy.description || '',
    }
  })
}

export async function list(
  payroll_period?: string,
  employeeIdOrCode?: string,
  requester?: { id?: string; role?: string }
) {
  const where: Prisma.PayrollRecordWhereInput = {}
  if (payroll_period) where.payroll_period = payroll_period

  if (requester?.role === 'EMPLOYEE' && requester.id) {
    const emp = await findEmployeeByUserId(requester.id)
    if (!emp) return []
    where.employeeId = emp.id
  } else if (employeeIdOrCode) {
    where.employee = buildIdOrCodeWhere(employeeIdOrCode)
  }

  // Chốt chặn Requirement 1: Quản lý không xem được phiếu lương của Quản lý khác
  if (requester?.role === 'MANAGER' && employeeIdOrCode) {
    const targetEmp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(employeeIdOrCode),
      include: {
        department: true,
        position: true,
        users: { include: { roles: true } },
      },
    })
    if (targetEmp && targetEmp.user_id !== requester.id && isEmployeeManager(targetEmp)) {
      throw AppError.forbidden('Quản lý không có quyền xem thông tin lương của Quản lý khác!')
    }
  }

  if (requester?.role === 'MANAGER') {
    if (employeeIdOrCode) await assertCanAccessEmployeeDetail(requester, employeeIdOrCode)
    const manager = await prisma.employee.findFirst({ where: { user_id: requester.id } })
    if (manager?.departmentId) where.AND = [{ OR: [{ employee: { departmentId: manager.departmentId } }, { employee: { user_id: requester.id } }] }]
  }
  const records = await prisma.payrollRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          department: true, position: true,
          users: { include: { roles: true } },
        },
      },
    },
    orderBy: { payroll_period: 'desc' },
  })

  // Nếu requester là MANAGER, ẩn hoàn toàn các phiếu lương của Quản lý khác (chỉ giữ lại chính mình và nhân sự thường)
  let filteredRecords = records
  if (requester?.role === 'MANAGER') {
    filteredRecords = records.filter((rec) => {
      if (rec.employee?.user_id === requester.id) return true
      return !isEmployeeManager(rec.employee)
    })
  }

  return filteredRecords.map(formatPayrollRecord)
}

export async function updateItem(
  idOrPayrollId: string,
  updates: {
    hourly_rate?: number
    allowance?: number
    total_working_hours?: number
    working_hours?: number
    total_overtime?: number
    total_late_early?: number
    net_salary?: number
    status?: PayrollStatus
    reason?: string
  },
  actorUser?: { id?: string; role?: string },
) {
  // 2. Tối ưu O(1) query trực tiếp theo ID hoặc parse format PR-YYYYMM-XXX, loại bỏ fetch toàn bộ bảng
  let record = null
  const prMatch = idOrPayrollId.match(/^PR-(\d{4})(\d{2})-(\d+)$/i)
  if (prMatch) {
    const recordId = BigInt(prMatch[3])
    const period = `${prMatch[1]}-${prMatch[2]}`
    record = await prisma.payrollRecord.findFirst({
      where: { id: recordId, payroll_period: period },
      include: {
        employee: {
          include: {
            department: true, position: true,
            users: { include: { roles: true } },
          },
        },
      },
    })
  } else if (/^\d+$/.test(idOrPayrollId)) {
    record = await prisma.payrollRecord.findUnique({
      where: { id: BigInt(idOrPayrollId) },
      include: {
        employee: {
          include: {
            department: true, position: true,
            users: { include: { roles: true } },
          },
        },
      },
    })
  }

  if (!record) throw new AppError(404, 'Payroll record not found')

  // Chốt chặn Requirement 5: Nếu kỳ lương đã Khóa (FINALIZED), chỉ Admin mới có quyền mở khóa/chỉnh sửa
  if (['FINALIZED', 'CONFIRMED', 'PAID'].includes(record.status)) {
    throw AppError.badRequest('Bảng lương kỳ này đã bị Khóa (Locked). Chỉ có Quản trị viên (Admin) mới có quyền mở khóa để chỉnh sửa!')
  }

  // Chốt chặn Requirement 1 & 2:
  // Không ai được tự chỉnh sửa phiếu lương của chính mình (Bất kiêm nhiệm)
  // Quản lý không được chỉnh sửa phiếu lương của Quản lý khác
  if (actorUser?.role !== 'ADMIN') {
    await assertCanAccessEmployeeDetail(actorUser, record.employeeId)
    assertCannotModifySelfControlData(actorUser, record.employee.user_id, 'chỉnh sửa phiếu lương của chính mình')
    assertCannotModifyOtherManager(actorUser, record.employee, 'chỉnh sửa phiếu lương')
  }

  const hourly_rate = updates.hourly_rate !== undefined ? updates.hourly_rate : Number(record.hourly_rate)
  const allowance = updates.allowance !== undefined ? updates.allowance : Number(record.allowance)
  const total_overtime = updates.total_overtime !== undefined ? roundHours(updates.total_overtime * 3600) : Number(record.total_overtime)
  const total_late_early = updates.total_late_early !== undefined ? roundHours(updates.total_late_early * 3600) : Number(record.total_late_early)
  const total_working_hours = updates.total_working_hours !== undefined
    ? roundHours(updates.total_working_hours * 3600)
    : (updates.working_hours !== undefined ? roundHours(updates.working_hours * 3600) : Number(record.total_working_hours ?? 0))

  if (updates.status && updates.status !== record.status) throw AppError.badRequest('Dùng thao tác chốt/mở khóa kỳ để đổi trạng thái')
  if ((updates.total_overtime !== undefined || updates.total_working_hours !== undefined || updates.working_hours !== undefined || updates.total_late_early !== undefined) && !updates.reason?.trim()) throw AppError.badRequest('Cần lý do điều chỉnh giờ công/OT')
  if (updates.total_overtime !== undefined && updates.total_overtime !== Number(record.total_overtime) || updates.total_late_early !== undefined && updates.total_late_early !== Number(record.total_late_early)) throw AppError.badRequest('Duyệt từng khoản OT/phạt theo ngày, không sửa tổng kỳ')
  const bonusPenalty = await getBonusPenalty()
  const overtimeRate = Number(record.overtime_rate ?? bonusPenalty.overtime_rate)
  const latePenaltyRate = Number(record.late_penalty_rate ?? bonusPenalty.late_early_penalty)

  const net_salary = calculateNetSalary({
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    allowance,
    overtime_rate: overtimeRate,
    late_early_penalty: latePenaltyRate,
    total_absence_penalty: Number(record.total_absence_penalty),
  })

  const updated = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${record.payroll_period}`}))`
    const fresh = await tx.payrollRecord.findUniqueOrThrow({ where: { id: record.id } })
    if (+fresh.updated_at !== +record.updated_at) throw AppError.conflict('Phiếu lương vừa thay đổi; tải lại trước khi sửa')
    const bounds = validatePeriod(record.payroll_period)
    const source = await tx.daily_attendance_summary.findMany({ where: { employee_id: record.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
    const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: record.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
    if ((record.calculation_details as Record<string, unknown> | null)?.adjustment_fingerprint !== adjustmentFingerprint(adjustments)) throw AppError.conflict('Các khoản OT/phạt đã thay đổi; tính lại lương trước khi chỉnh phiếu')
    if (['FINALIZED', 'CONFIRMED', 'PAID'].includes(fresh.status)) throw AppError.conflict('Kỳ lương đã khóa')
  const updated = await tx.payrollRecord.update({
    where: { id: record.id },
    data: {
      hourly_rate,
      total_working_hours,
      total_overtime,
      total_late_early,
      allowance,
      net_salary,
      overtime_rate: overtimeRate, late_penalty_rate: latePenaltyRate,
      calculation_details: { ...((record.calculation_details as Record<string, unknown>) || {}), policy: ATTENDANCE_POLICY_VERSION, source_fingerprint: summaryFingerprint(source), adjustment_fingerprint: adjustmentFingerprint(adjustments), manual: true, reason: updates.reason || 'PAYROLL_EDIT' },
      ...(updates.status ? { status: updates.status } : {}),
      updated_at: new Date(),
    },
    include: {
      employee: {
        include: { department: true },
      },
    },
  })
    await tx.auditLog.create({
      data: {
        userId: actorUser?.id,
        action: 'UPDATE_PAYROLL_RECORD',
        target_table: 'payroll_records',
        record_id: String(record.id),
        old_values: {
          hourly_rate: Number(record.hourly_rate),
          total_working_hours: Number(record.total_working_hours),
          total_overtime: Number(record.total_overtime),
          total_late_early: Number(record.total_late_early),
          allowance: Number(record.allowance),
          net_salary: Number(record.net_salary),
          status: record.status,
        },
        new_values: {
          hourly_rate,
          total_working_hours,
          total_overtime,
          total_late_early,
          allowance,
          net_salary,
          status: updated.status,
          reason: updates.reason || 'PAYROLL_EDIT',
        },
      },
    })
    return updated
  })

  return {
    ...formatPayrollRecord(updated),
    reason: updates.reason,
  }
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
  await aggregateDailyAttendance(bounds.month, bounds.year)
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    const allRows = await tx.payrollRecord.findMany({ where: { payroll_period: period }, include: { employee: { include: { users: { include: { roles: true } }, department: true, position: true } } } })
    const manager = actorRole === 'MANAGER' ? await tx.employee.findFirst({ where: { user_id: actorUserId } }) : null
    const rows = allRows.filter(row => row.status === 'PENDING' && (actorRole !== 'MANAGER' || (row.employee.user_id !== actorUserId && !isEmployeeManager(row.employee) && (!manager?.departmentId || row.employee.departmentId === manager.departmentId))))
    if (!rows.length) throw AppError.badRequest('Chưa có bảng lương thuộc quyền được chốt')
    const actor = { id: actorUserId, role: actorRole }
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
          ...(lockedWorkDates.length
            ? [{ work_date: { notIn: lockedWorkDates }, policy_version: { not: ATTENDANCE_POLICY_VERSION } }]
            : [{ policy_version: { not: ATTENDANCE_POLICY_VERSION } }]),
        ],
      },
    })
    const pendingAdjustments = await tx.attendanceAdjustment.count({ where: { employee_id: { in: rows.map(r => r.employeeId) }, work_date: { gte: bounds.start, lt: bounds.end }, status: 'PENDING' } })
    if (pendingAdjustments) throw AppError.conflict('Còn khoản OT/phạt chờ duyệt trước khi chốt lương')
    if (pending) throw AppError.conflict('Còn ngày công/OT cần xác minh hoặc duyệt trước khi chốt lương')
    for (const row of rows.filter(r => r.status === 'PENDING')) {
      const source = await tx.daily_attendance_summary.findMany({ where: { employee_id: row.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
      if (source.some(s => { const details = s.calculation_details as Record<string, unknown> | null; return details && !details.off && +new Date(String(details.scheduledEnd)) > Date.now() })) throw AppError.conflict('Còn ca chưa kết thúc, bao gồm ca qua đêm; chưa thể chốt lương')
      const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: row.employeeId, work_date: { gte: bounds.start, lt: bounds.end } } })
      if ((row.calculation_details as Record<string, unknown> | null)?.adjustment_fingerprint !== adjustmentFingerprint(adjustments)) throw AppError.conflict('Các khoản OT/phạt đã thay đổi; cần tính lại lương')
      if ((row.calculation_details as Record<string, unknown> | null)?.source_fingerprint !== summaryFingerprint(source)) throw AppError.conflict('Công/OT đã thay đổi sau lần tính lương; cần tính lại hoặc rà soát phiếu chỉnh tay trước khi chốt')
    }
    if (rows.some(r => (r.calculation_details as Record<string, unknown> | null)?.policy !== ATTENDANCE_POLICY_VERSION)) throw AppError.conflict('Cần tính lại bảng lương cũ theo chính sách đã chốt')
    await tx.payrollRecord.updateMany({ where: { id: { in: rows.map(r => r.id) }, status: 'PENDING' }, data: { status: 'FINALIZED' } })
    await tx.auditLog.create({ data: { userId: actorUserId, action: 'FINALIZE_PAYROLL_PERIOD', target_table: 'payroll_records', record_id: period, new_values: { period } } })
  })
  return list(period, undefined, { id: actorUserId, role: actorRole })
}

export async function unlockPeriod(period: string, actorUserId?: string) {
  validatePeriod(period)
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    if (await tx.payrollRecord.count({ where: { payroll_period: period, status: 'PAID' } })) throw AppError.conflict('Kỳ đã trả cần quy trình điều chỉnh riêng, không được ghi đè')
    await tx.payrollRecord.updateMany({ where: { payroll_period: period }, data: { status: 'PENDING' } })
    await tx.auditLog.create({ data: { userId: actorUserId, action: 'UNLOCK_PAYROLL_PERIOD', target_table: 'payroll_records', record_id: period, new_values: { period } } })
  })
  return list(period)
}

export async function generate(payroll_period: string, employeeId?: string, actorUserId?: string, actorUser?: { id?: string; role?: string }) {
  const { year, month, start, end } = validatePeriod(payroll_period)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  if (payroll_period > today.slice(0, 7)) throw AppError.badRequest('Không tính lương cho kỳ tương lai')
  await aggregateDailyAttendance(month, year, employeeId)
  const policy = await getBonusPenalty()
  return prisma.$transaction(async tx => {
    if (typeof (tx as any).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${payroll_period}`}))`
    }
    const candidates = await tx.employee.findMany({ where: employeeId ? buildIdOrCodeWhere(employeeId) : {
      OR: [{ status: 'ACTIVE' }, { daily_attendance_summary: { some: { work_date: { gte: start, lt: end } } } }],
    }, include: { department: true, position: true, users: { include: { roles: true } } } })
    const manager = actorUser?.role === 'MANAGER' ? await tx.employee.findFirst({ where: { user_id: actorUser.id } }) : null
    const employees = candidates.filter(emp => actorUser?.role !== 'MANAGER' || (emp.user_id !== actorUser.id && !isEmployeeManager(emp) && (!manager?.departmentId || emp.departmentId === manager.departmentId)))
    if (employeeId && !employees.length) throw AppError.forbidden('Không được tự tính lương hoặc tính lương cho quản lý khác')
    const results = []
    for (const emp of employees) {
      const existing = await tx.payrollRecord.findUnique({ where: { employeeId_payroll_period: { employeeId: emp.id, payroll_period } } })
      if (existing && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(existing.status)) {
        if (employeeId) throw AppError.conflict('Kỳ lương đã khóa/đã trả')
        continue
      }
      const manual = Boolean((existing?.calculation_details as Record<string, unknown> | null)?.manual)
      const summaries = await tx.daily_attendance_summary.findMany({ where: { employee_id: emp.id,
        work_date: { gte: start, lt: end, lte: new Date(`${today}T00:00:00Z`) } } })
      const sum = (field: 'total_working_hours' | 'late_early') => summaries.reduce((n, s) => n + Number(s[field]), 0)
      const adjustments = await tx.attendanceAdjustment.findMany({ where: { employee_id: emp.id, work_date: { gte: start, lt: end } } })
      const approved = adjustments.filter(a => a.status === 'APPROVED')
      const total_working_hours = manual ? Number(existing!.total_working_hours) : sum('total_working_hours')
      const total_late_early = approved.filter(a => a.kind === 'LATE_EARLY').reduce((n,a) => n + Number(a.hours), 0)
      const total_overtime = approved.filter(a => a.kind === 'OVERTIME').reduce((n,a) => n + Number(a.hours), 0)
      const total_absence_penalty = approved.filter(a => a.kind === 'ABSENCE').reduce((n,a) => n + Number(a.amount), 0)
      const hourly_rate = Number(manual ? existing!.hourly_rate : emp.hourly_rate ?? existing?.hourly_rate ?? 0)
      const allowance = existing ? Number(existing.allowance) : 1500000
      const overtime_rate = Number(existing?.overtime_rate ?? policy.overtime_rate)
      const late_penalty_rate = Number(existing?.late_penalty_rate ?? policy.late_early_penalty)
      const net_salary = calculateNetSalary({ hourly_rate, total_working_hours, total_overtime, total_late_early, allowance,
        overtime_rate, late_early_penalty: late_penalty_rate, total_absence_penalty })
      const data = { hourly_rate, total_working_hours, total_overtime, total_late_early, total_absence_penalty, allowance, net_salary,
        overtime_rate, late_penalty_rate, status: 'PENDING', calculation_details: {
          manual, reason: manual ? ((existing?.calculation_details as Record<string, unknown>)?.reason ?? 'PAYROLL_EDIT') : null,
          policy: ATTENDANCE_POLICY_VERSION, policy_id: policy.id, generated_at: new Date().toISOString(),
          source_fingerprint: summaryFingerprint(summaries),
          adjustment_fingerprint: adjustmentFingerprint(adjustments),
          adjustment_ids: approved.map(a => String(a.id)),
          summary_ids: summaries.map(s => String(s.id)), overtime_rate, late_penalty_rate,
          pending_review_days: summaries.filter(s => s.requires_review || s.overtime_status === 'PENDING').map(s => s.work_date.toISOString().slice(0, 10)),
        } }
      results.push(await tx.payrollRecord.upsert({ where: { employeeId_payroll_period: { employeeId: emp.id, payroll_period } },
        update: data, create: { employeeId: emp.id, payroll_period, ...data }, include: { employee: { include: { department: true } } } }))
    }
    if (typeof (tx as any).auditLog?.create === 'function') {
      await tx.auditLog.create({ data: { userId: actorUserId, action: 'GENERATE_PAYROLL', target_table: 'payroll_records', record_id: payroll_period,
        new_values: { employee_count: results.length, employeeId: employeeId || 'ALL' } } })
    }
    return results.map(formatPayrollRecord)
  }, {
    timeout: 30000,
    maxWait: 10000,
  })
}
