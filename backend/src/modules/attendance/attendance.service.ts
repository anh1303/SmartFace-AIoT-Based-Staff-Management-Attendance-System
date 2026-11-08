import { requireFingerprintBinding, assertNoFingerprintMaintenance, type FingerprintScan } from '../biometrics/fingerprint.attendance.js'
import { aggregateDailyAttendance } from './attendance.aggregation.js'
import { attendanceIntervalRemaining, attendanceIntervalMessage } from './attendance.interval.js'
export { aggregateDailyAttendance } from './attendance.aggregation.js'
import { createAttendanceSnapshot, restoreAttendanceFromSnapshot } from './attendance.snapshot.js'
export { createAttendanceSnapshot, restoreAttendanceFromSnapshot } from './attendance.snapshot.js'
import { formatAttendanceRecords } from './attendance.format.js'
export { extractTimeString, roundToHalfHour, parseTimeToSecondsInVN, calcShiftWorkingHours, determinePunctuality, formatAttendanceRecord, type RawAttendanceLogDb } from './attendance.format.js'
import { projectAttendanceDetails } from './attendance.details.js'
import { summarizeEmployeeMonth } from './attendance.overview.js'
import { ATTENDANCE_REASON_LABELS, displayAttendanceStatus } from './attendance.reasons.js'
import { assertAggregationHealthy, notifyLockedScan } from './attendance.alerts.js'
import { syncDayAdjustments, flushAdjustmentBatch } from './attendance.adjustments.js'
import { processThingsBoardWebhook, type ThingsBoardWebhookPayload } from './attendance.webhook.js'
import { Prisma } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { type DevSimulateFaceScanInput, devSimulateFaceScanSchema } from './attendance.dto.js'
import { findActiveManagerAndAdminUserIds } from '../auth/public.js'
import { sourceHourlyRate } from '../employees/public.js'
import {
  isPayrollPeriodClosed,
  getClosedPayrollEmployeeIds,
  getPayrollWageSnapshot,
  touchPendingPayrollForAttendance,
  markPendingPayrollsRecompute,
  findPeriodPayrolls,
  payrollOverrides,
} from '../payroll/public.js'
import { attendanceWorkDate, resolvePairWorkDate, calculateDay, prepareAttendance, vnDay, MAX_PAIR_MS, roundHours, hasLegacyOvernightBounds, ATTENDANCE_POLICY_VERSION } from './attendance.policy.js'
import { isAttendanceDateLocked } from './attendance.lock.js'
import { prisma } from '../../config/database.js'
import {
  assertCanManageEmployee,
  getEmployeeScope,
  findEmployeeByIdOrCode,
  findEmployeeByUserId,
  countScopedEmployees,
  findEmployeeWageProfile,
  assertCannotModifyOtherManager,
  assertCannotModifySelfControlData,
  type EmployeeActor,
} from '../employees/public.js'
import { getEmployeeNearShifts, getEmployeeShiftsForRecalculation, getEmployeeShiftsByFilter } from '../shifts/public.js'
import { AppError } from '../../common/AppError.js'
import { policyForPeriod } from '../../common/payroll-policy.js'
import { buildIdOrCodeWhere, formatVNDateISO, formatVNTime } from '../../common/utils.js'
import { attendanceInclude } from './attendance.model.js'
import { logAction } from '../audit-logs/public.js'
import { eventBus } from '../../common/event-bus.js'
import {
  ATTENDANCE_METHOD,
  type AttendanceMethod,
} from '../../common/constants.js'

const startOfToday = () => {
  const now = new Date()
  const vnStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  return new Date(`${vnStr}T00:00:00+07:00`)
}

export async function list(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = { employees: await getEmployeeScope(requesterUser) }

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) return []
    where.employee_id = emp.id
  } else {
    const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
      ? query.employeeId
      : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

    if (empIdFilter) {
      const emp = await findEmployeeByIdOrCode(empIdFilter)
      where.employee_id = emp ? emp.id : empIdFilter
    }
  }

  const startDate = (typeof query.startDate === 'string' && query.startDate)
    ? query.startDate
    : (typeof query.from === 'string' && query.from ? query.from : undefined)

  const endDate = (typeof query.endDate === 'string' && query.endDate)
    ? query.endDate
    : (typeof query.to === 'string' && query.to ? query.to : undefined)

  const singleDate = typeof query.date === 'string' && query.date ? query.date : undefined

  if (startDate && endDate) {
    where.event_time = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
      lt: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (startDate) {
    where.event_time = {
      gte: new Date(`${startDate}T00:00:00+07:00`),
    }
  } else if (endDate) {
    where.event_time = {
      lt: new Date(`${endDate}T23:59:59.999+07:00`),
    }
  } else if (singleDate) {
    where.event_time = {
      gte: new Date(`${singleDate}T00:00:00+07:00`),
      lt: new Date(`${singleDate}T23:59:59.999+07:00`),
    }
  }

  if (typeof query.type === 'string') {
    where.type = query.type
  }

  const isGetAll = query.limit === 'all' || query.all === 'true' || query.all === true
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const fullRange = query.fetchAllPages === 'true' || query.fetchAllPages === true
  const defaultLimit = fullRange ? 5000 : 50
  const limit = isGetAll ? 50000 : Math.min(fullRange ? 5000 : 200, Math.max(1, Math.floor(Number(query.limit) || defaultLimit)))
  const skip = isGetAll ? 0 : (page - 1) * limit

  const logs = await prisma.attendance_logs.findMany({
    where,
    include: query.compact === 'true'
      ? { employees: { select: { ...attendanceInclude.employees.select, avatar_url: false } } }
      : attendanceInclude,
    orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
    skip: skip > 0 ? skip : undefined,
    take: limit,
  })

  return formatAttendanceRecords(logs)
}

export async function getDailySummaries(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = { employees: await getEmployeeScope(requesterUser) }

  let empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) return []
    empIdFilter = emp.id
  }

  if (empIdFilter) {
    const emp = await findEmployeeByIdOrCode(empIdFilter)
    where.employee_id = emp ? emp.id : empIdFilter
  }

  const startDate = (typeof query.startDate === 'string' && query.startDate)
    ? query.startDate
    : (typeof query.from === 'string' && query.from ? query.from : undefined)

  const endDate = (typeof query.endDate === 'string' && query.endDate)
    ? query.endDate
    : (typeof query.to === 'string' && query.to ? query.to : undefined)

  const singleDate = typeof query.date === 'string' && query.date ? query.date : undefined

  if (startDate && endDate) {
    where.work_date = {
      gte: new Date(`${startDate}T00:00:00.000Z`),
      lte: new Date(`${endDate}T00:00:00.000Z`),
    }
  } else if (startDate) {
    where.work_date = {
      gte: new Date(`${startDate}T00:00:00.000Z`),
    }
  } else if (endDate) {
    where.work_date = {
      lte: new Date(`${endDate}T00:00:00.000Z`),
    }
  } else if (singleDate) {
    where.work_date = new Date(`${singleDate}T00:00:00.000Z`)
  }

  const summaries = await prisma.daily_attendance_summary.findMany({
    where,
    include: {
      employees: {
        select: {
          id: true,
          employee_code: true,
          full_name: true,
        },
      },
    },
  })

  return summaries.map(s => {
    const displayStatus = displayAttendanceStatus(s.attendance_status, s.review_reason, s.calculation_details)
    const details = s.calculation_details && typeof s.calculation_details === 'object' ? s.calculation_details as Record<string, unknown> : null
    const shiftEnd = details?.scheduledEnd ? new Date(String(details.scheduledEnd)) : null
    const isShiftEnded = shiftEnd ? +new Date() >= +shiftEnd : false
    const isAbsent = displayStatus === 'ABSENT' || Boolean(details?.absenceCandidate)
    return {
      id: s.id.toString(),
      employee_id: s.employees?.employee_code || s.employee_id,
      employee_uuid: s.employee_id,
      date: formatVNDateISO(s.work_date),
      total_working_hours: s.total_working_hours ? Number(s.total_working_hours) : 0,
      late_early: s.late_early ? Number(s.late_early) : 0,
      overtime: s.overtime ? Number(s.overtime) : 0,
      status: displayStatus,
      is_absent: isAbsent,
      is_shift_ended: isShiftEnded,
      first_check_in: s.first_check_in,
      last_check_out: s.last_check_out,
      overtime_candidate_hours: Number(s.overtime_candidate_hours),
      overtime_status: s.overtime_status,
      overtime_reason: s.overtime_reason,
      review_status: (s as any).review_status || 'NONE',
      approval_source: (s as any).approval_source || null,
      approval_reason: (s as any).approval_reason || null,
      approved_by: s.approved_by,
      approved_at: s.approved_at,
      requires_review: s.requires_review,
      review_reason: s.review_reason,
      reason_labels: ATTENDANCE_REASON_LABELS,
      policy_version: s.policy_version,
      calculation_details: projectAttendanceDetails(s.calculation_details, Number(s.total_working_hours), Number(s.overtime_candidate_hours)),
      regular_seconds: s.regular_seconds,
      overtime_seconds: s.overtime_seconds,
      late_early_seconds: s.late_early_seconds,
    }
  })
}

export async function getEmployeeOverview(query: Record<string, unknown>, requesterUser?: { id?: string; role?: string }) {
  const today = vnDay(new Date())
  const summaries = await getDailySummaries({ employeeId: query.employeeId, startDate: `${today.slice(0, 7)}-01`, endDate: today }, requesterUser)
  return { ...summarizeEmployeeMonth(summaries, today), today: summaries.filter(day => day.date === today) }
}

export async function assertEditableDay(
  tx: Prisma.TransactionClient,
  date: string,
  employeeId?: string,
  options?: { ignoreDayLock?: boolean }
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${date.slice(0, 7)}`}))`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${date}`}))`
  if (!options?.ignoreDayLock) {
    const lock = await tx.attendance_locks.findUnique({ where: { work_date: new Date(`${date}T00:00:00Z`) } })
    if (lock?.is_locked) throw AppError.conflict('Ngày công đã khóa. Cần mở khóa trước khi điều chỉnh.')
  }
  const finalized = await isPayrollPeriodClosed(date.slice(0, 7), employeeId, tx)
  if (finalized) throw AppError.conflict('Kỳ lương đã chốt/đã trả; cần mở khóa kỳ trước khi thay đổi công.')
}

export async function adjustAttendance(
  data: { employeeId: string; date: string; late_early: number; overtime: number; reason: string },
  actorUserId?: string,
  actorRole?: string,
) {
  if (!data.reason?.trim()) throw AppError.badRequest('Cần lý do điều chỉnh/duyệt OT')
  const result = await prisma.$transaction(async tx => {
    // 1. Lấy khóa giao dịch chuẩn trước khi đọc dữ liệu
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${data.date.slice(0, 7)}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${data.date}`}))`

    await aggregateDailyAttendance(Number(data.date.slice(5, 7)), Number(data.date.slice(0, 4)), data.employeeId, data.date, undefined, tx)

    // 2. Đọc lại thông tin nhân viên và ngày công mới nhất (fresh read)
    const emp = await findEmployeeByIdOrCode(data.employeeId, tx)
    if (!emp) throw AppError.notFound('Employee not found')
    await assertCanManageEmployee({ id: actorUserId, role: actorRole }, emp.id, tx)

    const key = { employee_id: emp.id, work_date: new Date(`${data.date}T00:00:00Z`) }
    const existing = await tx.daily_attendance_summary.findUnique({ where: { employee_id_work_date: key } })
    if (!existing) throw AppError.badRequest('Chưa có dữ liệu ngày công để điều chỉnh')

    const calculationDetails = existing.calculation_details as Record<string, unknown> | null
    const scheduledEnd = calculationDetails?.scheduledEnd
    if (!calculationDetails?.off && typeof scheduledEnd === 'string' && +new Date(scheduledEnd) > Date.now()) {
      throw AppError.conflict('Ca chưa kết thúc; chưa thể duyệt điều chỉnh ngày công')
    }

    // 3. Nhân viên có dấu hiệu reopened_at được phép vượt qua khóa ngày
    const isEmployeeUnlocked = existing && (existing as any).reopened_at !== null
    await assertEditableDay(tx, data.date, emp.id, { ignoreDayLock: Boolean(isEmployeeUnlocked) })

    const requestedOt = Number(data.overtime) || 0
    const requestedLateEarly = Number(data.late_early) || 0
    if (requestedOt < 0 || requestedLateEarly < 0) {
      throw AppError.badRequest('Số giờ tăng ca và đi trễ/về sớm không được âm')
    }

    const isOff = existing.attendance_status === 'OFF' || existing.attendance_status === 'NO_SHIFT' || Boolean(calculationDetails?.off) || calculationDetails?.assigned === false

    let finalLateEarly = requestedLateEarly
    if (isOff) {
      // Ngày nghỉ / Chưa xếp ca (OFF / NO_SHIFT): Không áp dụng đi trễ / về sớm -> luôn gán bằng 0
      finalLateEarly = 0

      // Tính tổng thời gian làm việc thực tế từ các cặp quét trong ngày OFF
      const pairs = Array.isArray(calculationDetails?.pairs) ? (calculationDetails.pairs as any[]) : []
      const totalActualWorkedSeconds = pairs.reduce((sum: number, p: any) => {
        const start = p.start ? +new Date(p.start) : 0
        const end = p.end ? +new Date(p.end) : 0
        return sum + (end > start ? (end - start) / 1000 : 0)
      }, 0)
      const maxAllowedOtHours = roundHours(totalActualWorkedSeconds)

      // Cho phép lớn hơn 4h, nhưng không được vượt quá tổng thời gian đi làm thực tế
      if (requestedOt > maxAllowedOtHours) {
        throw AppError.badRequest(`Số giờ tăng ca ngày nghỉ không được vượt quá tổng thời gian làm việc thực tế (${maxAllowedOtHours} giờ)`)
      }
    } else {
      // Ca làm việc thông thường: Giới hạn cứng tối đa 4 giờ tăng ca
      if (requestedOt > 4) {
        throw AppError.badRequest('Ca làm việc thông thường chỉ được phê duyệt tối đa 4 giờ tăng ca theo quy định')
      }

      const scheduledShiftSeconds = Number(calculationDetails?.scheduledShiftSeconds ?? 0)
      const shiftDurationHours = scheduledShiftSeconds > 0
        ? roundHours(scheduledShiftSeconds)
        : (calculationDetails?.scheduledStart && calculationDetails?.scheduledEnd
            ? roundHours(Math.max(0, (+new Date(calculationDetails.scheduledEnd as string) - +new Date(calculationDetails.scheduledStart as string)) / 1000))
            : 0)
      if (shiftDurationHours > 0 && requestedLateEarly > shiftDurationHours) {
        throw AppError.badRequest(`Số giờ đi trễ/về sớm không được vượt quá thời lượng ca làm việc (${shiftDurationHours} giờ)`)
      }
    }

    const overtime = roundHours(requestedOt * 3600), late = roundHours(finalLateEarly * 3600)
    const snapshot = (existing as any).reopened_at || !(existing as any).pre_approval_snapshot
      ? createAttendanceSnapshot(existing)
      : (existing as any).pre_approval_snapshot

    // 4. Lưu điều chỉnh -> chuyển thành APPROVED và xóa dấu hiệu mở khóa (reopened_at = null)
    const updated = await tx.daily_attendance_summary.update({
      where: { id: existing.id },
      data: {
        late_early: late,
        overtime: overtime,
        overtime_candidate_hours: overtime,
        manual_adjustment: true,
        overtime_status: overtime > 0 ? 'APPROVED' : 'NONE',
        overtime_reason: data.reason.trim(),
        review_status: 'APPROVED',
        approval_source: 'ADJUSTMENT',
        approved_by: actorUserId || 'MANAGER',
        approved_at: new Date(),
        approval_reason: data.reason.trim(),
        pre_approval_snapshot: snapshot,
        requires_review: false,
        review_reason: null,
        reopened_at: null,
        reopened_by: null,
      },
    })
    const adjustmentPolicy = await policyForPeriod(data.date.slice(0, 7), tx)
    const wageSnapshot = await getPayrollWageSnapshot(emp.id, data.date.slice(0, 7), tx)
    await syncDayAdjustments(tx, updated, sourceHourlyRate(emp, data.date.slice(0, 7), wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate)), adjustmentPolicy?.absence_penalty_rate ?? null)

    // 5. Đánh dấu phiếu lương của kỳ đang PENDING cần tính lại sau khi công thay đổi
    await touchPendingPayrollForAttendance(emp.id, data.date.slice(0, 7), (details) => ({ ...details, needs_recalculation: true }), tx)

    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'ADJUST_ATTENDANCE',
        target_table: 'daily_attendance_summary',
        record_id: String(existing.id),
        old_values: { late_early: Number(existing.late_early), overtime: Number(existing.overtime), status: existing.attendance_status },
        new_values: { late_early: late, overtime, reason: data.reason.trim(), actual_ot_seconds: existing.overtime_seconds },
      },
    })
    return { updated, emp: { id: emp.id, employee_code: emp.employee_code, user_id: emp.user_id } }
  }, { maxWait: 20000, timeout: 60000 })

  const summaryResult = {
    id: String(result.updated.id),
    employee_id: result.emp.employee_code,
    employee_uuid: result.emp.id,
    employee_user_id: result.emp.user_id,
    date: data.date,
    total_working_hours: Number(result.updated.total_working_hours),
    late_early: Number(result.updated.late_early),
    overtime: Number(result.updated.overtime),
    status: result.updated.attendance_status,
    overtime_status: result.updated.overtime_status,
    review_status: (result.updated as any).review_status || 'APPROVED',
    approval_source: (result.updated as any).approval_source || 'ADJUSTMENT',
    approval_reason: (result.updated as any).approval_reason || data.reason.trim(),
    approved_by: result.updated.approved_by,
    approved_at: result.updated.approved_at,
    reason: data.reason.trim(),
  }

  eventBus.publish('attendance:summary-updated', {
    employeeId: result.emp.id,
    workDate: data.date,
    summary: summaryResult,
  })

  return summaryResult
}

type CaptureOptions = {
  fingerprint?: FingerprintScan
  eventId?: string
  capturedAt?: number
  verificationScore?: number
  livenessScore?: number
  deviceId?: string
  verified?: boolean
  isDevSimulation?: boolean
  reason?: string
  method?: AttendanceMethod
  syncSummary?: boolean
}

async function recordAttendance(
  type: 'CHECK_IN' | 'CHECK_OUT',
  employeeId: string,
  device: string | undefined,
  requester: { id?: string; role?: string } | undefined,
  capture: CaptureOptions = {}
) {
  const employee = requester?.role === 'EMPLOYEE' && requester.id
    ? await findEmployeeByUserId(requester.id, undefined, 'identity')
    : await findEmployeeByIdOrCode(employeeId, undefined, 'identity')
  if (!employee) throw AppError.notFound('Employee not found')
  if (requester?.role?.toUpperCase() === 'MANAGER') {
    if (employee.user_id && requester.id && employee.user_id === requester.id) {
      throw AppError.forbidden('Quản lý không được tự thực hiện điểm danh thủ công cho chính mình')
    }
    await assertCanManageEmployee(requester, employee.id)
  } else if (requester && requester.role?.toUpperCase() !== 'EMPLOYEE') {
    await assertCanManageEmployee(requester, employee.id)
  }
  if (employee.status !== 'ACTIVE') throw AppError.forbidden('Nhân viên không ở trạng thái ACTIVE')
  const eventTime = new Date(capture.capturedAt ?? Date.now())
  if (!Number.isFinite(+eventTime)) throw AppError.badRequest('Thời điểm ghi nhận không hợp lệ')
  const flagged = +eventTime > Date.now() + 120000 || +eventTime < Date.now() - MAX_PAIR_MS
  const eventKey = capture.eventId ? createHash('sha256').update(`${capture.deviceId || device || 'web'}:${capture.eventId}`).digest('hex') : undefined
  const outcome = await prisma.$transaction(async tx => {
    // Lock adjacent periods in chronological order for cross-midnight/month pairs.
    const periods = [-1, 0, 1].map(offset => { const d = new Date(eventTime); d.setUTCMonth(d.getUTCMonth() + offset, 1); return vnDay(d).slice(0, 7) }).sort()
    for (const period of periods) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    if (requester?.role?.toUpperCase() === 'MANAGER') {
      if (employee.user_id && requester.id && employee.user_id === requester.id) {
        throw AppError.forbidden('Quản lý không được tự thực hiện điểm danh thủ công cho chính mình')
      }
      await assertCanManageEmployee(requester, employee.id, tx)
    } else if (requester && requester.role?.toUpperCase() !== 'EMPLOYEE') {
      await assertCanManageEmployee(requester, employee.id, tx)
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employee:${employee.id}`}))`
    if (capture.deviceId) await assertNoFingerprintMaintenance(tx, capture.deviceId)
    if (capture.fingerprint) await requireFingerprintBinding(tx, capture.fingerprint, employee.id)
    const currentEmployee = await findEmployeeWageProfile(employee.id, tx)
    if (!currentEmployee || currentEmployee.status !== 'ACTIVE') throw AppError.forbidden('Nhân viên không ở trạng thái ACTIVE')
    if (eventKey) {
      const existing = await tx.attendance_logs.findUnique({ where: { event_key: eventKey }, include: attendanceInclude })
      if (existing) {
        if (existing.employee_id !== employee.id || existing.type !== type) throw AppError.conflict('Event ID đã được dùng cho một lượt khác')
        const date = vnDay(existing.work_date || existing.event_time)
        const work_date = new Date(`${date}T00:00:00Z`)
        const lock = await tx.attendance_locks.findUnique({ where: { work_date } })
        const summary = await tx.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: employee.id, work_date } } })
        const reopened = Boolean(summary?.reopened_at)
        const closed = await isPayrollPeriodClosed(date.slice(0, 7), employee.id, tx)
        const accessDenied = flagged || existing.status === 'FLAGGED' || closed || Boolean(!reopened && (lock?.is_locked || summary?.review_status === 'APPROVED'))
        return { created: existing, affected: lock?.is_locked ? [] : [...new Set([date, vnDay(existing.event_time)])], duplicate: true, accessDenied, ignored: false as const }
      }
    }
    const latestAccepted = await tx.attendance_logs.findFirst({
      where: { employee_id: employee.id, status: 'VALID' },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    })
    // Use server receipt time inside the employee lock; device timestamps cannot shorten the interval.
    const remaining = attendanceIntervalRemaining(latestAccepted?.created_at)
    if (!flagged && latestAccepted && remaining > 0) {
      return { ignored: true as const, remaining, latestAccepted }
    }
    const previous = await tx.attendance_logs.findFirst({
      where: { employee_id: employee.id, status: 'VALID', event_time: { lte: eventTime } },
      orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
    })
    const eventDay = new Date(`${vnDay(eventTime)}T00:00:00Z`)
    const nearShifts = await getEmployeeNearShifts(employee.id, eventDay, MAX_PAIR_MS, tx)
    const schedule = nearShifts.map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
    const isPairing = type === 'CHECK_OUT' && previous?.type === 'CHECK_IN' && +eventTime - +previous.event_time <= MAX_PAIR_MS
    const pairDate = isPairing ? resolvePairWorkDate(previous.event_time, eventTime, schedule) : null
    const date = pairDate ?? attendanceWorkDate(eventTime, schedule)
    const previousCheckInDate = isPairing ? attendanceWorkDate(previous.event_time, schedule) : null
    const closedPeriod = await isPayrollPeriodClosed(date.slice(0, 7), employee.id, tx)
    const lockedDay = await tx.attendance_locks.findUnique({ where: { work_date: new Date(`${date}T00:00:00Z`) } })
    const existingDaySummary = tx.daily_attendance_summary?.findUnique
      ? await tx.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: employee.id, work_date: new Date(`${date}T00:00:00Z`) } } })
      : null
    const isApprovedDay = (existingDaySummary as any)?.review_status === 'APPROVED'
    const isEmployeeReopened = Boolean(existingDaySummary && (existingDaySummary as any).reopened_at !== null)
    const isDayBlockedForEmployee = Boolean(lockedDay?.is_locked && !isEmployeeReopened)
    const isBlocked = Boolean(closedPeriod || isDayBlockedForEmployee || (isApprovedDay && !isEmployeeReopened))
    const recordedMethod = capture.fingerprint
      ? 'FINGERPRINT' : capture.verified
      ? 'FACE'
      : (capture.method && capture.method !== 'FACE' ? capture.method : 'MANUAL')
    const created = await tx.attendance_logs.create({
      data: {
        employee_id: employee.id,
        type,
        event_time: eventTime,
        work_date: new Date(`${date}T00:00:00Z`),
        event_key: eventKey,
        method: recordedMethod,
        device_info: device || 'Web',
        verification_score: capture.verificationScore,
        liveness_score: capture.livenessScore,
        status: flagged || isBlocked ? 'FLAGGED' : 'VALID',
      },
      include: attendanceInclude,
    })
    if (isBlocked) await notifyLockedScan(tx, employee.id, created.id, type, eventTime, created.created_at)
    if (!capture.verified) {
      await tx.auditLog.create({
        data: {
          userId: requester?.id ?? null,
          action: `MANUAL_ATTENDANCE_${type}`,
          target_table: 'attendance_logs',
          record_id: String(created.id),
          new_values: {
            employee_id: employee.id,
            type,
            work_date: date,
            reason: capture.reason || (device?.startsWith('device:') ? 'Legacy direct MQTT check-in' : 'Chấm công thủ công qua Web/API'),
            device_info: device || 'Web',
            method: recordedMethod,
          },
        },
      })
    } else if (capture.isDevSimulation) {
      await tx.auditLog.create({
        data: {
          userId: requester?.id ?? null,
          action: 'DEV_SIMULATE_FACE_SCAN',
          target_table: 'attendance_logs',
          record_id: String(created.id),
          new_values: {
            employee_id: employee.id,
            type,
            work_date: date,
            reason: 'Developer Face Simulation (Dev Mode / Test)',
            device_info: device || 'DEV_SIMULATOR',
            method: 'FACE',
            verification_score: capture.verificationScore,
            liveness_score: capture.livenessScore,
            is_simulation: true,
          },
        },
      })
    }
    if (!isBlocked && isPairing && previous && previousCheckInDate && previousCheckInDate !== date) {
      await tx.attendance_logs.update({
        where: { id: previous.id },
        data: { work_date: new Date(`${date}T00:00:00Z`) },
      })
    }
    const affected = isBlocked ? [] : [...new Set([date, vnDay(eventTime), ...(previousCheckInDate ? [previousCheckInDate] : [])])]
    for (const day of affected) {
      const closed = await isPayrollPeriodClosed(day.slice(0, 7), employee.id, tx)
      const work_date = new Date(`${day}T00:00:00Z`)
      const dayLock = await tx.attendance_locks.findUnique({ where: { work_date } })
      const targetSummary = await tx.daily_attendance_summary.findUnique({ where: { employee_id_work_date: { employee_id: employee.id, work_date } } })
      const isTargetReopened = Boolean(targetSummary && (targetSummary as any)?.reopened_at !== null)
      const isTargetDayBlocked = Boolean(dayLock?.is_locked && !isTargetReopened)
      const isTargetApproved = (targetSummary as any)?.review_status === 'APPROVED'
      if (!closed && !isTargetDayBlocked && (!isTargetApproved || isTargetReopened)) {
        const invalidated = {
          policy_version: null,
          requires_review: true,
          review_reason: 'SOURCE_CHANGED',
          review_status: 'PENDING',
        }
        await tx.daily_attendance_summary.upsert({
          where: { employee_id_work_date: { employee_id: employee.id, work_date } },
          update: invalidated,
          create: { employee_id: employee.id, work_date, attendance_status: 'INCOMPLETE', ...invalidated },
        })
      }
    }
    return { created, affected, duplicate: false, accessDenied: false, ignored: false as const }
  }, { timeout: 15000, maxWait: 10000 })
  if (outcome.ignored) {
    return {
      id: String(outcome.latestAccepted.id), employee_id: employee.id,
      status: 'VALID', type: outcome.latestAccepted.type, event_time: outcome.latestAccepted.event_time,
      work_date: vnDay(outcome.latestAccepted.work_date || outcome.latestAccepted.event_time),
      duplicate: true, ignored: true, cooldown: true, retry_after_seconds: outcome.remaining,
      access_denied: false, summaries: [], message: attendanceIntervalMessage(outcome.remaining),
    }
  }
  const { created, affected, duplicate, accessDenied } = outcome
  // Raw logs are durable even if a summary calculation fails. A replay retries the same summaries.
  const updatedSummaries: Array<Record<string, unknown>> = []
  const shouldSyncSummary = capture.syncSummary !== false

  if (shouldSyncSummary) {
    for (const date of affected) {
      const calculated = await aggregateDailyAttendance(Number(date.slice(5, 7)), Number(date.slice(0, 4)), employee.id, date)
      updatedSummaries.push(...calculated.details)
    }
  } else if (affected.length > 0) {
    // Non-blocking background aggregation for edge/IoT webhooks to return sub-second response
    setImmediate(async () => {
      try {
        for (const date of affected) {
          await aggregateDailyAttendance(Number(date.slice(5, 7)), Number(date.slice(0, 4)), employee.id, date)
        }
        eventBus.publish('attendance:summary-updated', {
          employeeId: employee.id,
          workDate: vnDay(created.work_date || created.event_time),
          summary: { employee_id: employee.employee_code, employee_user_id: employee.user_id, dates: affected },
        })
      } catch (err) {
        console.error('[Attendance] Background aggregation error:', err)
      }
    })
  }

  const [formatted] = await formatAttendanceRecords([created])
  const result = { ...formatted, duplicate, ignored: false, cooldown: false, retry_after_seconds: 0, message: undefined as string | undefined, access_denied: accessDenied, summaries: updatedSummaries, work_date: vnDay(created.work_date || created.event_time) }
  if (shouldSyncSummary) {
    eventBus.publish('attendance:summary-updated', {
      employeeId: employee.id,
      workDate: vnDay(created.work_date || created.event_time),
      summary: { employee_id: employee.employee_code, employee_user_id: employee.user_id, dates: affected },
    })
  }
  if (!duplicate) eventBus.publish(type === 'CHECK_IN' ? 'attendance:checked-in' : 'attendance:checked-out', {
    employeeId: employee.id,
    logId: String(created.id),
    eventTime: created.event_time,
    type,
    method: created.method,
    deviceInfo: created.device_info,
    payload: result,
  })
  return result
}

export async function checkIn(
  data: {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    event_id?: string
    eventId?: string
    verification_score?: number | null
    reason?: string
  },
  requesterUser?: { id?: string; role?: string },
  capture: CaptureOptions = {}
) {
  const id = data.employeeId || data.employee_id
  if (!id && requesterUser?.role !== 'EMPLOYEE') throw AppError.badRequest('employeeId is required')
  const verified = Boolean(capture.verified || capture.isDevSimulation)
  const mergedCapture: CaptureOptions = {
    ...capture,
    eventId: capture.eventId || data.eventId || data.event_id,
    verificationScore: capture.verificationScore ?? (data.verification_score !== undefined && data.verification_score !== null ? Number(data.verification_score) : undefined),
    verified,
    reason: capture.reason || data.reason,
    method: capture.method || data.method,
  }
  return recordAttendance('CHECK_IN', id || '', data.device_info, requesterUser, mergedCapture)
}

export async function checkOut(
  targetOrData?: string | {
    employeeId?: string
    employee_id?: string
    device_info?: string
    method?: AttendanceMethod
    event_id?: string
    eventId?: string
    verification_score?: number | null
    reason?: string
  },
  secondArg?: string | { id?: string; role?: string },
  thirdArg?: { id?: string; role?: string },
  fourthArg?: CaptureOptions
) {
  const isObject = typeof targetOrData === 'object' && targetOrData !== null
  const targetEmployeeId = isObject ? (targetOrData.employeeId || targetOrData.employee_id) : targetOrData
  const isLegacy = typeof secondArg === 'string'
  const deviceInfo = isObject
    ? (targetOrData.device_info || (isLegacy ? secondArg : undefined))
    : (isLegacy ? secondArg : undefined)
  const requesterUser = isObject
    ? (typeof secondArg === 'object' ? secondArg : thirdArg)
    : (typeof secondArg === 'object' ? secondArg : thirdArg)
  const capture: CaptureOptions = (isObject ? (typeof secondArg === 'object' && !('id' in secondArg || 'role' in secondArg) ? (secondArg as CaptureOptions) : fourthArg) : fourthArg) || {}

  if (!targetEmployeeId && requesterUser?.role !== 'EMPLOYEE') throw AppError.badRequest('employeeId is required')
  const verified = Boolean(capture.verified || capture.isDevSimulation)
  const mergedCapture: CaptureOptions = {
    ...capture,
    eventId: capture.eventId || (isObject ? (targetOrData.eventId || targetOrData.event_id) : undefined),
    verificationScore: capture.verificationScore ?? (isObject && targetOrData.verification_score !== undefined && targetOrData.verification_score !== null ? Number(targetOrData.verification_score) : undefined),
    verified,
    reason: capture.reason || (isObject ? targetOrData.reason : undefined),
    method: capture.method || (isObject ? targetOrData.method : undefined),
  }
  return recordAttendance('CHECK_OUT', targetEmployeeId || '', deviceInfo, requesterUser, mergedCapture)
}

export async function devSimulateFaceScan(
  input: DevSimulateFaceScanInput,
  requesterUser?: { id?: string; role?: string }
) {
  if (!['development', 'test'].includes(process.env.NODE_ENV || '')) {
    throw AppError.forbidden('Tính năng giả lập chỉ khả dụng trong môi trường thử nghiệm/phát triển (Dev/Test)')
  }
  const data = devSimulateFaceScanSchema.parse(input)
  const employee = await findEmployeeByIdOrCode(data.employeeId)
  if (!employee) throw AppError.notFound('Không tìm thấy nhân viên')
  if (requesterUser?.role?.toUpperCase() === 'MANAGER') {
    if (employee.user_id && requesterUser.id && employee.user_id === requesterUser.id) {
      throw AppError.forbidden('Quản lý không được tự thực hiện giả lập quét mặt cho chính mình')
    }
    await assertCanManageEmployee(requesterUser, employee.id)
  } else if (requesterUser && requesterUser.role?.toUpperCase() !== 'EMPLOYEE') {
    await assertCanManageEmployee(requesterUser, employee.id)
  }

  const capture: CaptureOptions = {
    eventId: randomUUID(),
    capturedAt: Date.now(),
    deviceId: data.device_id || 'DEV_SIMULATOR',
    verified: true,
    isDevSimulation: true,
    livenessScore: data.antispoof_score ?? 0.95,
    verificationScore: data.verification_score ?? 0.92,
  }

  if (data.mode === 'CHECK_OUT') {
    return checkOut(employee.id, `device:${capture.deviceId}`, requesterUser, capture)
  } else {
    return checkIn({
      employeeId: employee.id,
      device_info: `device:${capture.deviceId}`,
    }, requesterUser, capture)
  }
}

export async function statistics(actor?: EmployeeActor) {
  const scope = await getEmployeeScope(actor)
  const start = startOfToday()
  const [checkedInToday, totalActiveEmployees] = await Promise.all([
    prisma.attendance_logs.groupBy({
      by: ['employee_id'],
      where: { employees: scope, type: 'CHECK_IN', event_time: { gte: start } },
    }),
    countScopedEmployees(scope),
  ])

  const checkedIn = checkedInToday.length

  return {
    date: formatVNDateISO(start),
    checkedIn,
    totalEmployees: totalActiveEmployees,
    absent: Math.max(0, totalActiveEmployees - checkedIn),
  }
}

export async function getLocks(actor?: EmployeeActor) {
  const locks = await prisma.attendance_locks.findMany({
    orderBy: { work_date: 'desc' },
  })
  return locks.map((l) => ({
    date: formatVNDateISO(l.work_date),
    is_locked: l.is_locked,
    locked_at: l.locked_at,
    locked_by: actor?.role?.toUpperCase() === 'ADMIN' ? l.locked_by : undefined,
  }))
}

export async function toggleLock(dateStr: string, is_locked: boolean, actorUserId?: string, actorRole?: string) {
  if (actorRole?.toUpperCase() !== 'ADMIN') throw AppError.forbidden('Only Admin can lock or unlock global attendance dates')
  const work_date = new Date(`${dateStr}T00:00:00.000Z`)
  const lock = await prisma.$transaction(async tx => {
    if (typeof (tx as any).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${dateStr.slice(0, 7)}`}))`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${dateStr}`}))`
    }

    if (is_locked) {
      if (dateStr === vnDay(new Date())) {
        const todayShifts = await getEmployeeShiftsByFilter({ workDate: work_date }, tx)
        if (!todayShifts.some(shift => shift.shift_type !== 'OFF')) {
          throw AppError.conflict('Hôm nay chưa có ca làm việc để chốt')
        }
      }
      await aggregateDailyAttendance(Number(dateStr.slice(5, 7)), Number(dateStr.slice(0, 4)), undefined, dateStr, undefined, tx)
    }

    const days = await tx.daily_attendance_summary.findMany({ where: { work_date }, include: { employees: true } })
    const empIds = days.map(d => d.employee_id)
    const closedEmpIds = await getClosedPayrollEmployeeIds(dateStr.slice(0, 7), tx)

    if (is_locked) {
      await assertAggregationHealthy(tx, dateStr.slice(0, 7))

      // 1. Kiểm tra ca đã phân: phải có bản tổng hợp tương ứng
      const assignedShifts = await getEmployeeShiftsByFilter({ workDate: work_date }, tx)
      const summaryEmpIdSet = new Set(days.map(d => d.employee_id))
      const missingSummary = assignedShifts.some(s => !summaryEmpIdSet.has(s.employee_id))
      if (missingSummary) {
        throw AppError.conflict('Có nhân viên đã phân ca nhưng chưa có bản tổng hợp chấm công; chưa thể khóa ngày')
      }

      const activeDays = days.filter(d => !closedEmpIds.has(d.employee_id))

      if (activeDays.some(day => {
        const shift = assignedShifts.find(row => row.employee_id === day.employee_id)
        return shift && hasLegacyOvernightBounds(dateStr, {
          ...shift, start_time: shift.start_time ?? shift.work_shifts?.start_time, end_time: shift.end_time ?? shift.work_shifts?.end_time,
        }, day.calculation_details)
      })) {
        throw AppError.conflict('Công ca qua đêm được tính theo quy tắc cũ; cần mở khóa và tổng hợp lại trước khi khóa ngày')
      }

      // 2. Không cho khóa khi dữ liệu cần tính lại sau khi đổi ca
      if (activeDays.some(d => d.requires_review && d.review_reason === 'SHIFT_CHANGED')) {
        throw AppError.conflict('Dữ liệu chấm công đang chờ tính lại sau khi đổi ca; chưa thể khóa ngày')
      }

      if (activeDays.some(d => {
        const details = d.calculation_details as Record<string, unknown> | null
        return details && !details.off && +new Date(String(details.scheduledEnd)) > Date.now()
      })) {
        throw AppError.conflict('Ca chưa kết thúc, bao gồm ca qua đêm; chưa thể khóa ngày')
      }
      const adjustmentPolicy = await policyForPeriod(dateStr.slice(0, 7), tx)
      for (const day of activeDays) {
        // VẤN ĐỀ 6: Nếu ngày công đã APPROVED và KHÔNG bị mở khóa (reopened_at === null),
        // giữ nguyên quyết định đã duyệt riêng trước đó, không ghi đè người duyệt hay phân loại lại!
        if (day.review_status === 'APPROVED' && !(day as any).reopened_at) {
          continue
        }

        const details = (day.calculation_details || {}) as Record<string, any>
        const isOff = day.attendance_status === 'OFF' || day.attendance_status === 'NO_SHIFT' || Boolean(details.off) || details.assigned === false
        const snapshot = (day as any).reopened_at || !(day as any).pre_approval_snapshot
          ? createAttendanceSnapshot(day)
          : (day as any).pre_approval_snapshot

        // Phân loại OFF / NO_SHIFT trước khi kiểm tra thiếu lượt: Admin khóa ngày thì toàn bộ công, OT, trễ sớm bằng 0
        if (isOff) {
          const updated = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: {
              attendance_status: day.attendance_status === 'NO_SHIFT' ? 'NO_SHIFT' : 'OFF',
              total_working_hours: 0,
              overtime: 0,
              overtime_candidate_hours: 0,
              overtime_status: 'NONE',
              late_early: 0,
              late_early_seconds: 0,
              regular_seconds: 0,
              overtime_seconds: 0,
              review_status: 'APPROVED',
              approval_source: 'MANUAL',
              approved_by: actorUserId || 'ADMIN',
              approved_at: new Date(),
              approval_reason: day.approval_reason || 'Chốt ngày nghỉ (không phát sinh công và tăng ca khi chốt toàn công ty)',
              pre_approval_snapshot: snapshot,
              requires_review: false,
              reopened_at: null,
              reopened_by: null,
            },
          })
          const wageProfile = await findEmployeeWageProfile(day.employee_id, tx)
          const wageSnapshot = await getPayrollWageSnapshot(day.employee_id, dateStr.slice(0, 7), tx)
          const rate = sourceHourlyRate(wageProfile || day.employees, dateStr.slice(0, 7), wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null)
          continue
        }

        const hasValidPairs = Array.isArray(details.pairs) && details.pairs.length > 0
        const hasCheckIn = Boolean(day.first_check_in) || hasValidPairs
        const hasCheckOut = Boolean(day.last_check_out) || hasValidPairs
        const hasAnyEvents = Boolean((Array.isArray(details.events) && details.events.length > 0) || hasCheckIn || hasCheckOut)
        const isTrueAbsent = day.attendance_status === 'ABSENT' || Boolean(details.absenceCandidate) || !hasAnyEvents

        if (isTrueAbsent) {
          // VẮNG MẶT HOÀN TOÀN: Giữ nguyên ABSENT, không đổi thành INCOMPLETE
          const updated = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: {
              attendance_status: 'ABSENT',
              total_working_hours: 0,
              overtime: 0,
              overtime_candidate_hours: 0,
              overtime_status: 'NONE',
              late_early: 0,
              late_early_seconds: 0,
              regular_seconds: 0,
              overtime_seconds: 0,
              review_status: 'APPROVED',
              approval_source: 'MANUAL',
              approved_by: actorUserId || 'ADMIN',
              approved_at: new Date(),
              approval_reason: day.approval_reason || 'Chốt thủ công: vắng mặt không lý do',
              pre_approval_snapshot: snapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: true },
              reopened_at: null,
              reopened_by: null,
            },
          })
          const wageProfile = await findEmployeeWageProfile(day.employee_id, tx)
          const wageSnapshot = await getPayrollWageSnapshot(day.employee_id, dateStr.slice(0, 7), tx)
          const rate = sourceHourlyRate(wageProfile || day.employees, dateStr.slice(0, 7), wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null)
          continue
        }

        const isMissingScans = !hasValidPairs && ((hasCheckIn && !hasCheckOut) || (!hasCheckIn && hasCheckOut))
        const reviewReasons = (day.review_reason || '').split(',').filter(Boolean)
        const isUnderMinShift = reviewReasons.some((r: string) => ['UNDER_MINIMUM_SHIFT', 'UNDER_HALF_SHIFT'].includes(r))
        const hasFatalScanError = isMissingScans || reviewReasons.some((r: string) => ['MISSING_CHECK_OUT', 'NO_VALID_PAIR', 'INVALID_PAIR', 'FLAGGED_EVENT', 'UNPAIRED_CHECK_OUT'].includes(r))
        const isRealIncompleteOrError = Boolean(
          (!isUnderMinShift && day.attendance_status === 'INCOMPLETE') ||
          hasFatalScanError ||
          (!isUnderMinShift && details.isMissingOrIncomplete)
        )

        if (isRealIncompleteOrError) {
          // Quy tắc mới: Ca thiếu lượt quét không chuyển thành ABSENT mà chuyển trễ/sớm bằng đúng số giờ của ca
          const scheduledShiftSeconds = Number(details.scheduledShiftSeconds ?? 0)
          const shiftDurationHours = scheduledShiftSeconds > 0
            ? roundHours(scheduledShiftSeconds)
            : (details.scheduledStart && details.scheduledEnd
                ? roundHours(Math.max(0, (+new Date(details.scheduledEnd) - +new Date(details.scheduledStart)) / 1000))
                : 0)

          const updated = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: {
              attendance_status: 'INCOMPLETE',
              total_working_hours: 0,
              overtime: 0,
              overtime_candidate_hours: 0,
              overtime_status: 'NONE',
              late_early: shiftDurationHours,
              late_early_seconds: Math.round(shiftDurationHours * 3600),
              regular_seconds: 0,
              overtime_seconds: 0,
              review_status: 'APPROVED',
              approval_source: 'MANUAL',
              approved_by: actorUserId || 'ADMIN',
              approved_at: new Date(),
              approval_reason: `Chốt thủ công: ca thiếu lượt quét quy đổi trễ/sớm toàn bộ ca (${shiftDurationHours} giờ) thay vì nghỉ không phép`,
              pre_approval_snapshot: snapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: false },
              reopened_at: null,
              reopened_by: null,
            },
          })
          const wageProfile = await findEmployeeWageProfile(day.employee_id, tx)
          const wageSnapshot = await getPayrollWageSnapshot(day.employee_id, dateStr.slice(0, 7), tx)
          const rate = sourceHourlyRate(wageProfile || day.employees, dateStr.slice(0, 7), wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null)
        } else {
          const cappedOt = isUnderMinShift ? 0 : Math.min(Number(day.overtime_candidate_hours ?? 0), 4)
          const updated = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: {
              review_status: 'APPROVED',
              approval_source: 'MANUAL',
              approved_by: actorUserId || 'ADMIN',
              approved_at: new Date(),
              total_working_hours: isUnderMinShift ? 0 : day.total_working_hours,
              late_early: Number(day.late_early ?? 0),
              overtime: cappedOt,
              overtime_status: cappedOt > 0 ? 'APPROVED' : 'NONE',
              pre_approval_snapshot: snapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: false },
              approval_reason: isUnderMinShift ? 'Chốt ngày: ca không đạt ngưỡng 2/3 (0 công, phạt trễ/sớm)' : day.approval_reason,
              reopened_at: null,
              reopened_by: null,
            },
          })
          const wageProfile = await findEmployeeWageProfile(day.employee_id, tx)
          const wageSnapshot = await getPayrollWageSnapshot(day.employee_id, dateStr.slice(0, 7), tx)
          const rate = sourceHourlyRate(wageProfile || day.employees, dateStr.slice(0, 7), wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null)
        }
      }
    } else {
      const activeDays = days.filter(d => !closedEmpIds.has(d.employee_id))
      const adjustmentPolicy = await policyForPeriod(dateStr.slice(0, 7), tx)
      for (const day of activeDays) {
        const snapshot = (day as any).pre_approval_snapshot as Record<string, any> | null
        let restoredRecord: any
        if (snapshot && !snapshot.reconstructed) {
          // VẤN ĐỀ 5: Mở khóa cả ngày cũng đặt reopened_at để tác vụ tự chốt bỏ qua
          const restoredData = restoreAttendanceFromSnapshot(day, snapshot, { isPersonalUnlock: true, reopenedBy: actorUserId || 'ADMIN' })
          restoredRecord = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: restoredData,
          })
        } else {
          // Không có snapshot: tính lại từ dữ liệu quét gốc và phân ca
          const empLogs = await tx.attendance_logs.findMany({
            where: {
              employee_id: day.employee_id,
              event_time: {
                gte: new Date(+work_date - MAX_PAIR_MS),
                lt: new Date(+work_date + 2 * MAX_PAIR_MS),
              },
            },
            orderBy: [{ event_time: 'asc' }, { id: 'asc' }],
          })
          const empShifts = await getEmployeeShiftsForRecalculation(day.employee_id, work_date, MAX_PAIR_MS, tx)
          const shiftsWithTimes = empShifts.map(s => ({
            ...s,
            start_time: s.start_time ?? s.work_shifts.start_time,
            end_time: s.end_time ?? s.work_shifts.end_time,
          }))
          const prepared = prepareAttendance(empLogs, shiftsWithTimes)
          const assigned = shiftsWithTimes.find(s => vnDay(s.work_date) === dateStr)
          const calculation = calculateDay(dateStr, empLogs, assigned || null, new Date(), shiftsWithTimes, prepared)
          const hasPendingIssues = calculation.requiresReview || calculation.overtimeCandidateHours > 0 || calculation.lateEarlyHours > 0 || calculation.absenceCandidate
          const restoredStatus = hasPendingIssues ? 'PENDING' : 'NONE'

          restoredRecord = await tx.daily_attendance_summary.update({
            where: { id: day.id },
            data: {
              total_working_hours: calculation.workingHours,
              late_early: calculation.lateEarlyHours,
              overtime: 0,
              regular_seconds: Math.round(calculation.regularSeconds),
              overtime_seconds: Math.round(calculation.overtimeSeconds),
              late_early_seconds: Math.round(calculation.lateEarlySeconds),
              overtime_candidate_hours: calculation.overtimeCandidateHours,
              overtime_status: calculation.overtimeCandidateHours > 0 ? 'PENDING' : 'NONE',
              attendance_status: calculation.status,
              review_status: restoredStatus,
              requires_review: calculation.requiresReview,
              review_reason: calculation.requiresReview ? 'AUTO_CALCULATED' : null,
              manual_adjustment: false,
              calculation_details: calculation.details,
              approved_by: null,
              approved_at: null,
              approval_source: null,
              approval_reason: 'Mở khóa cả ngày: tính lại từ dữ liệu quét gốc',
              pre_approval_snapshot: Prisma.DbNull,
              reopened_at: new Date(),
              reopened_by: actorUserId || 'ADMIN',
            },
          })
        }
        const wageProfile = await findEmployeeWageProfile(day.employee_id, tx)
        const wageSnapshot = await getPayrollWageSnapshot(day.employee_id, dateStr.slice(0, 7), tx)
        const rate = sourceHourlyRate(wageProfile || day.employees, dateStr.slice(0, 7), wageSnapshot?.hourly_rate, false)
        await syncDayAdjustments(tx, restoredRecord, rate, adjustmentPolicy?.absence_penalty_rate ?? null)
      }

      // Đánh dấu needs_recalculation cho các bảng lương đang PENDING trong tháng
      await markPendingPayrollsRecompute(
        activeDays.map(d => d.employee_id),
        dateStr.slice(0, 7),
        'ATTENDANCE_LOCK_TOGGLED',
        tx
      )
    }
    const lock = await tx.attendance_locks.upsert({
      where: { work_date },
      update: { is_locked, locked_at: new Date(), locked_by: actorUserId || 'ADMIN' },
      create: { work_date, is_locked, locked_by: actorUserId || 'ADMIN' },
    })
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: is_locked ? 'LOCK_ATTENDANCE_DATE' : 'UNLOCK_ATTENDANCE_DATE',
        target_table: 'attendance_locks',
        record_id: dateStr,
        new_values: { date: dateStr, is_locked },
      },
    })
    return lock
  }, { maxWait: 20000, timeout: 60000 })

  return {
    date: formatVNDateISO(lock.work_date),
    is_locked: lock.is_locked,
    locked_at: lock.locked_at,
    locked_by: lock.locked_by,
  }
}

/**
 * Mở khóa ngày công cho TỪNG nhân viên:
 * Khôi phục snapshot trước khi duyệt (nếu có) hoặc tính lại từ nguồn,
 * đặt dấu hiệu reopened_at để vượt qua khóa ngày và không bị tự chốt lại,
 * đồng bộ lại các khoản OT/phạt, đánh dấu phiếu lương cần tính lại.
 */
export async function unlockEmployeeAttendance(
  input: { employeeId: string; date: string; reason?: string },
  actor: { id?: string; role?: string }
) {
  const { employeeId, date: dateStr, reason } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw AppError.badRequest('Định dạng ngày không hợp lệ (YYYY-MM-DD)')
  if (!['ADMIN', 'MANAGER'].includes(actor.role || '')) {
    throw AppError.forbidden('Chỉ Admin hoặc Quản lý mới có quyền mở khóa ngày công')
  }

  const workDate = new Date(`${dateStr}T00:00:00Z`)

  const result = await prisma.$transaction(async tx => {
    // 1. Khóa theo thứ tự chuẩn
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${dateStr.slice(0, 7)}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${dateStr}`}))`
    // 2. Tìm thông tin nhân viên trước để lấy UUID chuẩn
    const emp = await findEmployeeByIdOrCode(employeeId, tx)
    if (!emp) throw AppError.notFound('Không tìm thấy nhân viên')

    // 3. Mở khóa từng nhân viên hoạt động độc lập với khóa cả ngày (ignoreDayLock = true)
    await assertEditableDay(tx, dateStr, emp.id, { ignoreDayLock: true })

    await assertCanManageEmployee(actor, emp.id, tx)
    assertCannotModifySelfControlData(actor, emp.user_id, 'mở khóa ngày công')
    assertCannotModifyOtherManager(actor, emp, 'mở khóa ngày công')

    const summary = await tx.daily_attendance_summary.findFirst({
      where: { employee_id: emp.id, work_date: workDate },
    })
    if (!summary) throw AppError.notFound('Chưa có dữ liệu tổng hợp ngày công cho nhân viên trong ngày này')

    const snapshot = (summary as any).pre_approval_snapshot as Record<string, any> | null
    const period = dateStr.slice(0, 7)
    const adjustmentPolicy = await policyForPeriod(period, tx)

    let updated: any
    if (snapshot && !snapshot.reconstructed) {
      // 1. Khôi phục đầy đủ từ snapshot bằng helper chung và đặt reopened_at
      const restoredData = restoreAttendanceFromSnapshot(summary, snapshot, {
        isPersonalUnlock: true,
        reopenedBy: actor.id,
      })
      updated = await tx.daily_attendance_summary.update({
        where: { id: summary.id },
        data: restoredData,
      })
    } else {
      // 2. Không có snapshot (hoặc snapshot chỉ là reconstructed): tính lại từ dữ liệu quét gốc và phân ca
      const empLogs = await tx.attendance_logs.findMany({
        where: {
          employee_id: emp.id,
          event_time: {
            gte: new Date(+workDate - MAX_PAIR_MS),
            lt: new Date(+workDate + 2 * MAX_PAIR_MS),
          },
        },
        orderBy: [{ event_time: 'asc' }, { id: 'asc' }],
      })
      const empShifts = await getEmployeeShiftsForRecalculation(emp.id, workDate, MAX_PAIR_MS, tx)
      const shiftsWithTimes = empShifts.map(s => ({
        ...s,
        start_time: s.start_time ?? s.work_shifts.start_time,
        end_time: s.end_time ?? s.work_shifts.end_time,
      }))
      const prepared = prepareAttendance(empLogs, shiftsWithTimes)
      const assigned = shiftsWithTimes.find(s => vnDay(s.work_date) === dateStr)
      const calculation = calculateDay(dateStr, empLogs, assigned || null, new Date(), shiftsWithTimes, prepared)

      const hasPendingIssues = calculation.requiresReview || calculation.overtimeCandidateHours > 0 || calculation.lateEarlyHours > 0 || calculation.absenceCandidate
      const restoredStatus = hasPendingIssues ? 'PENDING' : 'NONE'
      const restoredDetails = { ...(calculation.details || {}) } as Record<string, any>

      updated = await tx.daily_attendance_summary.update({
        where: { id: summary.id },
        data: {
          total_working_hours: calculation.workingHours,
          late_early: calculation.lateEarlyHours,
          overtime: 0,
          regular_seconds: Math.round(calculation.regularSeconds),
          overtime_seconds: Math.round(calculation.overtimeSeconds),
          late_early_seconds: Math.round(calculation.lateEarlySeconds),
          overtime_candidate_hours: calculation.overtimeCandidateHours,
          overtime_status: calculation.overtimeCandidateHours > 0 ? 'PENDING' : 'NONE',
          attendance_status: calculation.status,
          review_status: restoredStatus,
          requires_review: calculation.requiresReview,
          review_reason: calculation.requiresReview ? 'AUTO_CALCULATED' : null,
          manual_adjustment: false,
          calculation_details: restoredDetails,
          approved_by: null,
          approved_at: null,
          approval_source: null,
          approval_reason: 'Mở khóa: tính lại từ dữ liệu quét gốc',
          pre_approval_snapshot: Prisma.DbNull,
          reopened_at: new Date(),
          reopened_by: actor.id ?? null,
        },
      })
    }

    const wageSnapshot = await getPayrollWageSnapshot(emp.id, period, tx)
    const rate = sourceHourlyRate(emp, period, wageSnapshot?.hourly_rate, false)
    await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null)

    // Đánh dấu bảng lương đang PENDING cần tính lại
    await touchPendingPayrollForAttendance(emp.id, period, (pDetails) => ({ ...pDetails, needs_recalculation: true }), tx)

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: snapshot ? 'UNLOCK_EMPLOYEE_ATTENDANCE' : 'RECALCULATE_FROM_RAW_DATA',
        target_table: 'daily_attendance_summary',
        record_id: String(summary.id),
        old_values: {
          review_status: summary.review_status,
          overtime: summary.overtime,
          approved_by: summary.approved_by,
        },
        new_values: {
          review_status: updated.review_status,
          employee_code: emp.employee_code,
          date: dateStr,
          reason: reason || (snapshot ? 'Mở khóa ngày công nhân viên' : 'Tính lại từ dữ liệu quét gốc và phân ca'),
          reopened_at: updated.reopened_at,
        },
      },
    })

    return {
      id: summary.id,
      employee_id: emp.employee_code,
      employee_db_id: emp.id,
      date: dateStr,
      review_status: updated.review_status,
      message: `Đã mở khóa ngày công ${dateStr} cho nhân viên ${emp.full_name}`,
    }
  })

  eventBus.publish('attendance:summary-updated', {
    employeeId: result.employee_db_id,
    workDate: result.date,
    summary: {
      employee_id: result.employee_id,
      dates: [result.date],
    },
  })

  return {
    id: result.id,
    employee_id: result.employee_id,
    date: result.date,
    review_status: result.review_status,
    message: result.message,
  }
}


export { type ThingsBoardWebhookPayload } from './attendance.webhook.js'

export function handleThingsBoardWebhook(data: ThingsBoardWebhookPayload) {
  return processThingsBoardWebhook(data, { checkIn, checkOut })
}

/**
 * Public Module API: Lấy toàn bộ daily_attendance_summary theo danh sách nhân viên và khoảng thời gian (cho Payroll module)
 */
export async function getAttendanceSummariesByEmployeesAndDateRange(
  employeeIds: string[],
  startDate: Date,
  endDate: Date
) {
  return prisma.daily_attendance_summary.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { work_date: 'asc' },
  })
}

/**
 * Tính thời điểm 00:05 sáng (giờ VN) của ngày kế tiếp sau ngày làm việc dateStr (YYYY-MM-DD).
 * Múi giờ Việt Nam là UTC+7. Mốc 00:05 VN ngày hôm sau tương đương 17:05 UTC của chính ngày làm việc dateStr.
 */
export function getAutoCloseThresholdVN(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 17, 5, 0, 0))
}

/** Lock the whole day only after its attendance summaries have been approved. */
export async function autoLockAttendanceDate(dateStr: string, asOf = new Date()): Promise<boolean> {
  if (+asOf < +getAutoCloseThresholdVN(dateStr)) return false
  const work_date = new Date(`${dateStr}T00:00:00.000Z`)
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${dateStr.slice(0, 7)}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${dateStr}`}))`
    const aggregation = await tx.attendanceAggregationState.findUnique({ where: { period: dateStr.slice(0, 7) } })
    if (aggregation?.failed) return false
    const current = await tx.attendance_locks.findUnique({ where: { work_date } })
    if (current?.is_locked) return false
    if (current && +asOf < +current.locked_at + 24 * 60 * 60 * 1000 && +current.locked_at >= +getAutoCloseThresholdVN(dateStr)) return false

    const shifts = (await getEmployeeShiftsByFilter({ workDate: work_date }, tx)).filter(shift => shift.shift_type !== 'OFF')
    const summaries = await tx.daily_attendance_summary.findMany({ where: { work_date }, select: { employee_id: true, review_status: true, calculation_details: true } })
    const approved = new Set(summaries.filter(summary => {
      const details = summary.calculation_details as { scheduledEnd?: string } | null
      return summary.review_status === 'APPROVED' && (!details?.scheduledEnd || +new Date(details.scheduledEnd) <= +asOf)
    }).map(summary => summary.employee_id))
    if (!summaries.length || summaries.some(summary => !approved.has(summary.employee_id)) || shifts.some(shift => !approved.has(shift.employee_id))) return false

    await tx.attendance_locks.upsert({
      where: { work_date },
      create: { work_date, is_locked: true, locked_at: asOf, locked_by: 'SYSTEM_AUTO' },
      update: { is_locked: true, locked_at: asOf, locked_by: 'SYSTEM_AUTO' },
    })
    await tx.auditLog.create({ data: { action: 'LOCK_ATTENDANCE_DATE', target_table: 'attendance_locks', record_id: dateStr, new_values: { date: dateStr, is_locked: true, source: 'AUTO' } } })
    return true
  }, { maxWait: 20000, timeout: 60000 })
}

export async function autoLockCompletedAttendanceDates(asOf = new Date()): Promise<number> {
  const today = vnDay(asOf)
  const [year, month] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 2, 1))
  const end = new Date(`${today}T00:00:00.000Z`)
  const shifts = await getEmployeeShiftsByFilter({ workDate: { gte: start, lte: end } })
  const summaries = await prisma.daily_attendance_summary.findMany({ where: { work_date: { gte: start, lt: end } }, select: { work_date: true }, distinct: ['work_date'] })
  const locked = await prisma.attendance_locks.findMany({ where: { work_date: { gte: start, lt: end }, is_locked: true }, select: { work_date: true } })
  const lockedDates = new Set(locked.map(lock => vnDay(lock.work_date)))
  const dates = [...new Set([...shifts.filter(shift => shift.shift_type !== 'OFF').map(shift => vnDay(shift.work_date)), ...summaries.map(summary => vnDay(summary.work_date))])].filter(date => date < today && !lockedDates.has(date))
  let count = 0
  for (const date of dates) if (await autoLockAttendanceDate(date, asOf)) count++
  return count
}

/**
 * Kiểm tra xem ngày công đang mở khóa bởi Quản lý có còn trong thời gian bảo vệ hay không:
 * - Nếu mở khóa trước 00:05 VN của ngày kế tiếp (trong ngày ca): Bảo vệ đến mốc 00:05 VN ngày kế tiếp.
 *   Khi thời gian đạt từ 00:05 VN ngày kế tiếp trở đi, quyền mở khóa hết hạn -> hệ thống tự động chốt lại.
 * - Nếu mở khóa một ngày trong quá khứ (sau 00:05 VN): Bảo vệ trong 24 giờ kể từ thời điểm mở khóa.
 *   Sau 24 giờ không xét duyệt, hệ thống tự động chốt lại để tránh treo công vĩnh viễn.
 */
export function isManagerReopenedProtected(
  summary: { reopened_at?: Date | null; reopened_by?: string | null } | null | undefined,
  asOf: Date,
  autoCloseThreshold: Date
): boolean {
  if (!summary?.reopened_at || summary.reopened_by === 'SHIFT_CHANGED') {
    return false
  }
  const reopenedTime = new Date(summary.reopened_at).getTime()
  const thresholdTime = autoCloseThreshold.getTime()

  // 1. Mở khóa trong ngày ca làm việc (trước 00:05 ngày hôm sau):
  // Hết hạn bảo vệ khi thời gian asOf đạt từ 00:05 ngày hôm sau trở đi.
  if (reopenedTime < thresholdTime) {
    return asOf.getTime() < thresholdTime
  }

  // 2. Mở khóa ngày trong quá khứ: bảo vệ trong 24 giờ kể từ thời điểm mở khóa
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
  return asOf.getTime() < reopenedTime + TWENTY_FOUR_HOURS_MS
}

/**
 * Tự động chốt công cho các ca đến hạn (hết giờ ca và từ 00:05 VN ngày hôm sau) và xử lý ca quá hạn OT 4h.
 * - Lúc 0h05 VN ngày kế tiếp, ca đã có lượt ra hợp lệ -> chốt APPROVED, nguồn AUTO.
 * - Ca chưa có lượt ra nhưng vẫn đang trong khoảng OT tối đa 4 giờ -> chưa chốt ngay.
 * - Khi hết mốc giờ kết thúc ca + 4 giờ, nếu vẫn thiếu lượt ra thì tự xử lý thành nghỉ không lý do rồi chốt APPROVED.
 * - Bảo đảm chỉ chốt từ 00:05 VN ngày kế tiếp; không chốt trước 00:05 kể cả khi khởi động lại.
 * - Truy vấn ngày công được giới hạn chặt chẽ vào đúng kỳ đang lặp, không áp dụng sai chính sách của kỳ khác.
 */
export async function autoCloseDueAttendance(asOf = new Date()) {
  const todayVN = vnDay(asOf)
  const [yearStr, monthStr] = todayVN.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const previous = new Date(Date.UTC(year, month - 2, 1))

  const periods = [
    `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`,
    `${year}-${String(month).padStart(2, '0')}`,
  ]

  let closedCount = 0
  let absentConvertedCount = 0

  for (const period of periods) {
    await prisma.$transaction(async tx => {
      // 1. Khóa kỳ lương đồng bộ với các thao tác tính lương và tổng hợp
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
      const adjustmentPolicy = await policyForPeriod(period, tx)

      // 2. Giới hạn truy vấn vào đúng kỳ đang xử lý (tránh áp dụng sai chính sách tháng)
      const [pYear, pMonth] = period.split('-').map(Number)
      const periodStart = new Date(Date.UTC(pYear, pMonth - 1, 1))
      const periodEnd = new Date(Date.UTC(pYear, pMonth, 1))

      const unapproved = await tx.daily_attendance_summary.findMany({
        where: {
          work_date: {
            gte: periodStart,
            lt: periodEnd,
          },
          review_status: { not: 'APPROVED' },
        },
        include: { employees: true },
      })

      if (!unapproved.length) return

      const employeeIds = [...new Set(unapproved.map(day => day.employee_id))]
      const [payrolls, adjustmentRows] = await Promise.all([
        findPeriodPayrolls(employeeIds, period, tx),
        tx.attendanceAdjustment.findMany({ where: { employee_id: { in: employeeIds }, work_date: { gte: periodStart, lt: periodEnd } } }),
      ])
      const payrollByEmployee = new Map(payrolls.map(row => [row.employeeId, row]))
      const adjustmentBatch = { existing: new Map(adjustmentRows.map(row => [`${row.employee_id}:${row.work_date.toISOString().slice(0, 10)}:${row.kind}`, row])), writes: [] as Prisma.AttendanceAdjustmentCreateManyInput[], audits: [] as Prisma.AuditLogCreateManyInput[] }
      const lockedDays = new Set<string>()
      let managerUserIds: string[] | undefined
      const pendingNotifications: Array<{ user_id: string; employee_id: string; event_key: string; title: string; message: string }> = []

      for (const summary of unapproved) {
        const dateStr = vnDay(summary.work_date)

        // 3. Khóa ngày công đồng bộ theo thứ tự chuẩn: payroll:${period} -> attendance:${dateStr}
        if (!lockedDays.has(dateStr)) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${dateStr}`}))`
          lockedDays.add(dateStr)
        }

        // 4. Không tự ý thay đổi ngày công thuộc kỳ lương đã chốt/thanh toán
        const wageSnapshot = payrollByEmployee.get(summary.employee_id) ?? null
        const isClosed = Boolean(wageSnapshot && ['FINALIZED', 'CONFIRMED', 'PAID'].includes(wageSnapshot.status))
        if (isClosed) continue

        // 5. Kiểm tra lại trạng thái fresh của bản ghi ngay trong giao dịch (tránh ghi đè khi chạy song song)
        let freshSummary = await tx.daily_attendance_summary.findUnique({
          where: { id: summary.id },
          include: { employees: true },
        })

        const autoCloseThreshold = getAutoCloseThresholdVN(dateStr)

        // CHỐT CHẶN BẢO ĐẢM: Chỉ tự chốt công từ 00:05 VN ngày hôm sau trở đi
        // Ngăn chặn hoàn toàn việc chốt trước 00:05 khi backend khởi động lại hoặc chạy theo chu kỳ
        if (+asOf < +autoCloseThreshold) {
          continue
        }

        // Tự chốt bỏ qua các ngày đã APPROVED hoặc đang được Quản lý mở khóa còn trong thời hạn bảo vệ
        const isManagerReopened = isManagerReopenedProtected(freshSummary as any, asOf, autoCloseThreshold)
        if (!freshSummary || freshSummary.review_status === 'APPROVED' || isManagerReopened) {
          continue
        }

        const sourceChanged = freshSummary.review_reason === 'SOURCE_CHANGED' || !freshSummary.policy_version
        if (sourceChanged) {
          await aggregateDailyAttendance(Number(dateStr.slice(5, 7)), Number(dateStr.slice(0, 4)), freshSummary.employee_id, dateStr, undefined, tx)
          freshSummary = await tx.daily_attendance_summary.findUnique({ where: { id: summary.id }, include: { employees: true } })
          const isManagerReopenedAfterAgg = isManagerReopenedProtected(freshSummary as any, asOf, autoCloseThreshold)
          if (!freshSummary || freshSummary.review_status === 'APPROVED' || isManagerReopenedAfterAgg || !freshSummary.policy_version || freshSummary.review_reason === 'SOURCE_CHANGED') continue
        }

        const isPastDay = dateStr < todayVN
        const details = (freshSummary.calculation_details || {}) as Record<string, any>
        const scheduledEnd = details.scheduledEnd ? new Date(details.scheduledEnd) : null
        const isOff = details.off || details.assigned === false || freshSummary.attendance_status === 'OFF' || freshSummary.attendance_status === 'NO_SHIFT'
        const otCutoff = scheduledEnd ? new Date(+scheduledEnd + 4 * 3600000) : null

        const baseSnapshot = createAttendanceSnapshot(freshSummary)

        if (isOff) {
          if (isPastDay) {
            // Quy tắc mới: Hệ thống tự chốt thì ca OFF / NO_SHIFT toàn bộ giờ làm, tăng ca, trễ sớm đều bằng 0
            const updated = await tx.daily_attendance_summary.update({
              where: { id: freshSummary.id },
              data: {
                attendance_status: freshSummary.attendance_status === 'NO_SHIFT' ? 'NO_SHIFT' : 'OFF',
                total_working_hours: 0,
                overtime: 0,
                overtime_candidate_hours: 0,
                overtime_status: 'NONE',
                late_early: 0,
                late_early_seconds: 0,
                regular_seconds: 0,
                overtime_seconds: 0,
                review_status: 'APPROVED',
                approval_source: 'AUTO',
                approved_at: asOf,
                approved_by: 'SYSTEM_AUTO',
                approval_reason: 'Tự động chốt ngày nghỉ (không phát sinh công và tăng ca do chưa có phê duyệt riêng của quản lý)',
                pre_approval_snapshot: baseSnapshot,
                requires_review: false,
                reopened_at: null,
                reopened_by: null,
              },
            })
            const rate = sourceHourlyRate(freshSummary.employees, period, wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
            await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null, sourceChanged ? undefined : adjustmentBatch)
            closedCount++
          }
          continue
        }

        if (!scheduledEnd || !otCutoff) continue

        const hasValidPairs = Array.isArray(details.pairs) && details.pairs.length > 0
        const hasCheckIn = Boolean(freshSummary.first_check_in) || hasValidPairs
        const hasCheckOut = Boolean(freshSummary.last_check_out) || hasValidPairs
        const shiftEnded = +asOf >= +scheduledEnd
        const otExpired = +asOf >= +otCutoff

        // Hôm nay: giữ NONE hoặc PENDING, không tự chuyển APPROVED
        if (!isPastDay) continue

        const hasAnyEvents = Boolean((Array.isArray(details.events) && details.events.length > 0) || hasCheckIn || hasCheckOut)
        const isTrueAbsent = freshSummary.attendance_status === 'ABSENT' || Boolean(details.absenceCandidate) || !hasAnyEvents

        if (isTrueAbsent && shiftEnded) {
          // VẮNG MẶT HOÀN TOÀN: Giữ nguyên ABSENT, 0 công, 0 OT, 0 trễ/sớm, áp dụng phạt vắng
          const snapshot = (freshSummary as any).reopened_at || !(freshSummary as any).pre_approval_snapshot
            ? baseSnapshot
            : (freshSummary as any).pre_approval_snapshot

          const updated = await tx.daily_attendance_summary.update({
            where: { id: freshSummary.id },
            data: {
              attendance_status: 'ABSENT',
              total_working_hours: 0,
              overtime: 0,
              overtime_candidate_hours: 0,
              overtime_status: 'NONE',
              late_early: 0,
              late_early_seconds: 0,
              regular_seconds: 0,
              overtime_seconds: 0,
              review_status: 'APPROVED',
              approval_source: 'AUTO',
              approved_at: asOf,
              approved_by: 'SYSTEM_AUTO',
              approval_reason: 'Tự động chốt: vắng mặt không lý do',
              pre_approval_snapshot: snapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: true },
              reopened_at: null,
              reopened_by: null,
            },
          })
          const rate = sourceHourlyRate(freshSummary.employees, period, wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null, sourceChanged ? undefined : adjustmentBatch)
          closedCount++
          continue
        }

        const isMissingScans = !hasValidPairs && ((hasCheckIn && !hasCheckOut) || (!hasCheckIn && hasCheckOut))
        const reviewReasons = (freshSummary.review_reason || '').split(',').filter(Boolean)
        const isUnderMinShift = reviewReasons.some((r: string) => ['UNDER_MINIMUM_SHIFT', 'UNDER_HALF_SHIFT'].includes(r))
        const hasFatalScanError = isMissingScans || reviewReasons.some((r: string) => ['MISSING_CHECK_OUT', 'NO_VALID_PAIR', 'INVALID_PAIR', 'FLAGGED_EVENT', 'UNPAIRED_CHECK_OUT'].includes(r))
        const isRealIncompleteOrError = Boolean(
          (!isUnderMinShift && freshSummary.attendance_status === 'INCOMPLETE') ||
          hasFatalScanError ||
          (!isUnderMinShift && details.isMissingOrIncomplete)
        )

        if (!isRealIncompleteOrError && shiftEnded) {
          const cappedOt = isUnderMinShift ? 0 : Math.min(Number(freshSummary.overtime_candidate_hours ?? 0), 4)
          const updated = await tx.daily_attendance_summary.update({
            where: { id: freshSummary.id },
            data: {
              review_status: 'APPROVED',
              approval_source: 'AUTO',
              approved_at: asOf,
              approved_by: 'SYSTEM_AUTO',
              total_working_hours: isUnderMinShift ? 0 : freshSummary.total_working_hours,
              late_early: Number(freshSummary.late_early ?? 0),
              overtime: cappedOt,
              overtime_status: cappedOt > 0 ? 'APPROVED' : 'NONE',
              pre_approval_snapshot: baseSnapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: false },
              approval_reason: isUnderMinShift
                ? 'Tự động chốt: ca không đạt ngưỡng 2/3 (0 công, phạt trễ/sớm)'
                : details.overtimeCapped
                  ? 'Tự động chốt: ca hợp lệ có OT vượt 4h đã cắt về tối đa 4h tính lương'
                  : null,
              reopened_at: null,
              reopened_by: null,
            },
          })
          const rate = sourceHourlyRate(freshSummary.employees, period, wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null, sourceChanged ? undefined : adjustmentBatch)
          closedCount++
        } else if (isRealIncompleteOrError && otExpired) {
          const snapshot = (freshSummary as any).reopened_at || !(freshSummary as any).pre_approval_snapshot
            ? baseSnapshot
            : (freshSummary as any).pre_approval_snapshot

          // Quy tắc mới: Ca thiếu lượt quét quy đổi trễ/sớm bằng số giờ ca thay vì chuyển thành ABSENT
          const scheduledShiftSeconds = Number(details.scheduledShiftSeconds ?? 0)
          const shiftDurationHours = scheduledShiftSeconds > 0
            ? roundHours(scheduledShiftSeconds)
            : (details.scheduledStart && details.scheduledEnd
                ? roundHours(Math.max(0, (+new Date(details.scheduledEnd) - +new Date(details.scheduledStart)) / 1000))
                : 0)

          const updated = await tx.daily_attendance_summary.update({
            where: { id: freshSummary.id },
            data: {
              attendance_status: 'INCOMPLETE',
              total_working_hours: 0,
              overtime: 0,
              overtime_candidate_hours: 0,
              overtime_status: 'NONE',
              late_early: shiftDurationHours,
              late_early_seconds: Math.round(shiftDurationHours * 3600),
              regular_seconds: 0,
              overtime_seconds: 0,
              review_status: 'APPROVED',
              approval_source: 'AUTO',
              approved_at: asOf,
              approved_by: 'SYSTEM_AUTO',
              approval_reason: `Tự động chốt: ca thiếu lượt quét sau khi hết hạn, quy đổi trễ/sớm toàn bộ ca (${shiftDurationHours} giờ) thay vì nghỉ không phép`,
              pre_approval_snapshot: snapshot,
              requires_review: false,
              calculation_details: { ...details, absenceCandidate: false },
              reopened_at: null,
              reopened_by: null,
            },
          })
          const rate = sourceHourlyRate(freshSummary.employees, period, wageSnapshot?.hourly_rate, Boolean(payrollOverrides(wageSnapshot).fields.hourly_rate))
          await syncDayAdjustments(tx, updated, rate, adjustmentPolicy?.absence_penalty_rate ?? null, sourceChanged ? undefined : adjustmentBatch)
          closedCount++

          managerUserIds ??= await findActiveManagerAndAdminUserIds(tx)
          pendingNotifications.push(...managerUserIds.map(userId => ({
            user_id: userId,
            employee_id: freshSummary.employee_id,
            event_key: `auto-incomplete:${freshSummary.id}`,
            title: 'Tự động chốt ca thiếu lượt chấm công',
            message: `Nhân viên ${freshSummary.employees.full_name}, ngày ${dateStr} đã được hệ thống tự động chốt phạt trễ/sớm toàn ca (${shiftDurationHours} giờ) do thiếu lượt chấm công. Quản lý có thể mở khóa để chỉnh sửa nếu cần.`,
          })))
        }
      }
      await flushAdjustmentBatch(tx, adjustmentBatch)
      if (pendingNotifications.length) await tx.systemNotification.createMany({ data: pendingNotifications, skipDuplicates: true })
    }, { timeout: 60000, maxWait: 20000 })
  }

  return { closedCount, absentConvertedCount }
}

/**
 * Rà soát và đối chiếu các ngày công có nguy cơ bị ảnh hưởng bởi phiên bản chính sách mới.
 * - Phát hiện các ngày có chênh lệch giữa chính sách đã duyệt và chính sách mới (v7).
 * - Nếu kỳ lương đã chốt/thanh toán: Trả về danh sách cảnh báo để quản lý lập phiếu điều chỉnh có kiểm soát, TUYỆT ĐỐI không tự ý sửa lịch sử lương.
 * - Nếu kỳ lương còn mở và ngày chưa khóa: Cho phép tùy chọn tự động mở lại để tổng hợp lại an toàn.
 */
export async function auditAttendancePolicyDiscrepancies(
  period: string,
  autoReopenOpenPeriods = false
) {
  const [yearStr, monthStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const summaries = await prisma.daily_attendance_summary.findMany({
    where: {
      work_date: { gte: startDate, lte: endDate },
    },
    include: { employees: true },
  })

  const results: Array<{
    id: bigint
    employee_code: string
    employee_name: string
    date: string
    status: string
    review_status: string
    current_hours: number
    is_payroll_closed: boolean
    is_day_locked: boolean
    has_discrepancy: boolean
    reason: string
    action_taken: 'NONE' | 'REOPENED_FOR_RECALCULATION' | 'MANUAL_PAYROLL_ADJUSTMENT_REQUIRED'
  }> = []

  for (const s of summaries) {
    const dateStr = vnDay(s.work_date)
    const isClosed = await isPayrollPeriodClosed(period, s.employee_id)
    const isLocked = await isAttendanceDateLocked(s.work_date)
    const details = (s.calculation_details || {}) as Record<string, any>
    const pairs = Array.isArray(details.pairs) ? details.pairs : []

    const hadEarlyArrivalNullCheckIn = pairs.length > 0 && !s.first_check_in
    const hadIncompleteDueToMissingScan = s.attendance_status === 'INCOMPLETE' && pairs.length > 0
    const hasDiscrepancy = hadEarlyArrivalNullCheckIn || hadIncompleteDueToMissingScan || s.policy_version !== ATTENDANCE_POLICY_VERSION

    if (hasDiscrepancy) {
      let actionTaken: 'NONE' | 'REOPENED_FOR_RECALCULATION' | 'MANUAL_PAYROLL_ADJUSTMENT_REQUIRED' = 'NONE'
      if (isClosed) {
        actionTaken = 'MANUAL_PAYROLL_ADJUSTMENT_REQUIRED'
      } else if (autoReopenOpenPeriods && !isLocked) {
        await prisma.daily_attendance_summary.update({
          where: { id: s.id },
          data: {
            requires_review: true,
            review_reason: 'POLICY_V7_MIGRATION',
            review_status: 'PENDING',
            reopened_at: new Date(),
            reopened_by: 'POLICY_V7_MIGRATION',
          },
        })
        await aggregateDailyAttendance(month, year, s.employee_id, dateStr)
        actionTaken = 'REOPENED_FOR_RECALCULATION'
      }

      results.push({
        id: s.id,
        employee_code: s.employees.employee_code,
        employee_name: s.employees.full_name,
        date: dateStr,
        status: s.attendance_status,
        review_status: s.review_status,
        current_hours: Number(s.total_working_hours),
        is_payroll_closed: isClosed,
        is_day_locked: isLocked,
        has_discrepancy: true,
        reason: hadEarlyArrivalNullCheckIn
          ? 'Ca đến sớm có cặp quét hợp lệ nhưng first_check_in bị null theo v6'
          : hadIncompleteDueToMissingScan
            ? 'Ca có cặp quét hợp lệ bị chốt INCOMPLETE nhầm'
            : `Chính sách lưu (${s.policy_version}) khác chính sách hiện hành (${ATTENDANCE_POLICY_VERSION})`,
        action_taken: actionTaken,
      })
    }
  }

  return results
}

/**
 * Public Module API: Kiểm tra ngày làm việc có bị khóa công (attendance_locks) hay không
 */
export { isAttendanceDateLocked } from './attendance.lock.js'

export async function findAttendanceLogByEventKey(eventKey: string) {
  return prisma.attendance_logs.findUnique({ where: { event_key: eventKey } })
}

export async function findRecentValidAttendanceLog(employeeId: string, sinceDate: Date, untilDate: Date) {
  return prisma.attendance_logs.findFirst({
    where: {
      employee_id: employeeId,
      status: 'VALID',
      event_time: { gte: sinceDate, lte: untilDate },
    },
    orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
  })
}
