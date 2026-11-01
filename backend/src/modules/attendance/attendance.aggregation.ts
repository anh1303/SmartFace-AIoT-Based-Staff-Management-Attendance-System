import { Prisma } from '@prisma/client'
import { setImmediate as yieldToRequests } from 'node:timers/promises'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { policyForPeriod } from '../../common/payroll-policy.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { sourceHourlyRate, findEmployeesWithFilter } from '../employees/public.js'
import { getEmployeeShiftsForAggregation } from '../shifts/public.js'
import { payrollOverrides, findPeriodPayrolls } from '../payroll/public.js'
import { calculateDay, prepareAttendance, vnDay, MAX_PAIR_MS } from './attendance.policy.js'
import { syncDayAdjustments, flushAdjustmentBatch } from './attendance.adjustments.js'

/**
 * Tự động tổng hợp dữ liệu chấm công từ attendance_logs và employee_shifts
 * sang bảng daily_attendance_summary cho một tháng cụ thể (month: 1-12, year: e.g. 2026).
 * Đảm bảo luồng tính lương thông suốt: Sắp lịch -> Quẹt thẻ Checkin/out -> Tổng hợp ngày -> Tính lương cuối tháng.
 */
export async function aggregateDailyAttendance(
  month: number,
  year: number,
  employeeId?: string,
  onlyDate?: string,
  employeeScope: Prisma.EmployeeWhereInput = {},
  tx?: Prisma.TransactionClient
) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw AppError.badRequest('Tháng/năm không hợp lệ')
  const runWithTx = async (tx: Prisma.TransactionClient) => {
    if (typeof (tx as any).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${year}-${String(month).padStart(2, '0')}`}))`
    }
    const start = onlyDate ? new Date(`${onlyDate}T00:00:00Z`) : new Date(Date.UTC(year, month - 1, 1))
    const end = onlyDate ? new Date(+start + MAX_PAIR_MS) : new Date(Date.UTC(year, month, 1))
    const first = `${year}-${String(month).padStart(2, '0')}-01`
    const today = vnDay(new Date())
    const employees = await findEmployeesWithFilter({
      AND: [
        employeeScope,
        employeeId ? buildIdOrCodeWhere(employeeId) : {
          OR: [
            { status: 'ACTIVE' },
            { employee_shifts: { some: { work_date: { gte: start, lt: end } } } },
            { attendance_logs: { some: { event_time: { gte: new Date(+start - MAX_PAIR_MS), lt: new Date(+end + MAX_PAIR_MS) } } } },
          ],
        },
      ],
    }, undefined, tx)
    const ids = employees.map(e => e.id)
    if (!ids.length) return { month, year, totalSummaries: 0, details: [] }
    const [shifts, logs, summaries, locks, periodPayroll, adjustmentRows] = await Promise.all([
      getEmployeeShiftsForAggregation(ids, start, end, MAX_PAIR_MS, tx),
      tx.attendance_logs.findMany({ where: { employee_id: { in: ids }, event_time: {
        gte: new Date(+new Date(`${onlyDate || first}T00:00:00+07:00`) - MAX_PAIR_MS),
        lt: new Date(+end + MAX_PAIR_MS),
      } }, orderBy: [{ event_time: 'asc' }, { id: 'asc' }] }),
      tx.daily_attendance_summary.findMany({ where: { employee_id: { in: ids }, work_date: { gte: start, lt: end } } }),
      tx.attendance_locks.findMany({ where: { work_date: { gte: start, lt: end }, is_locked: true } }),
      findPeriodPayrolls(ids, first.slice(0, 7), tx),
      tx.attendanceAdjustment.findMany({ where: { employee_id: { in: ids }, work_date: { gte: start, lt: end } } }),
    ])
    const adjustmentBatch = { existing: new Map(adjustmentRows.map(r => [`${r.employee_id}:${r.work_date.toISOString().slice(0,10)}:${r.kind}`, r])), writes: [] as Prisma.AttendanceAdjustmentCreateManyInput[], audits: [] as Prisma.AuditLogCreateManyInput[] }
    const lockedDates = new Set(locks.map(l => vnDay(l.work_date)))
    const closedEmployees = new Set(periodPayroll.filter(p => ['FINALIZED', 'CONFIRMED', 'PAID'].includes(p.status)).map(p => p.employeeId))
    const pendingWrites: Array<Record<string, unknown>> = []
    const invalidations: Prisma.AuditLogCreateManyInput[] = []
    const details: Array<Record<string, unknown>> = []
    const adjustmentPolicy = await policyForPeriod(first.slice(0, 7), tx)
    let lastYield = performance.now()
    for (const emp of employees) {
      const empLogs = logs.filter(l => l.employee_id === emp.id)
      const empShifts = shifts.filter(s => s.employee_id === emp.id).map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
      const prepared = prepareAttendance(empLogs, empShifts)
      const pairing = prepared.pairing
      const pairedOuts = new Set(pairing.pairs.map(p => p.outId))
      const dates = new Set([
        ...shifts.filter(s => s.employee_id === emp.id).map(s => vnDay(s.work_date)),
        ...empLogs.filter(l => !pairedOuts.has(String(l.id))).map(l => prepared.workDate(l.event_time)),
        ...summaries.filter(s => s.employee_id === emp.id).map(s => vnDay(s.work_date)),
      ])
      for (const date of [...dates].sort()) {
        // Promise microtasks alone do not let HTTP handlers/timers run during CPU work.
        if (performance.now() - lastYield >= 10) {
          await yieldToRequests()
          lastYield = performance.now()
        }
        if (date.slice(0, 7) !== first.slice(0, 7) || date > today || (onlyDate && date !== onlyDate)) continue
        const assigned = empShifts.find(s => vnDay(s.work_date) === date)
        const calculation = calculateDay(date, empLogs, assigned || null, new Date(), empShifts, prepared)
        const workDate = new Date(`${date}T00:00:00Z`)
        const previous = summaries.find(s => s.employee_id === emp.id && vnDay(s.work_date) === date)
        const isEmployeeReopened = Boolean(previous && (previous as any).reopened_at !== null)
        const isDayLocked = lockedDates.has(date)
        const isPayrollClosed = closedEmployees.has(emp.id)
        const isApproved = (previous as any)?.review_status === 'APPROVED'

        // Bản ghi chỉ được xử lý khi:
        // 1. Kỳ lương chưa chốt (không thuộc FINALIZED/CONFIRMED/PAID)
        // 2. Ngày chưa khóa TOÀN CỤC HOẶC nhân viên đã được chủ động MỞ KHÓA CÁ NHÂN (reopened_at)
        // 3. Chưa APPROVED HOẶC nhân viên đã được MỞ KHÓA CÁ NHÂN (reopened_at)
        const canProcessRecord = !isPayrollClosed && (!isDayLocked || isEmployeeReopened) && (!isApproved || isEmployeeReopened)

        if (!canProcessRecord) {
          if (previous) {
            details.push({
              employee_code: emp.employee_code,
              employee_name: emp.full_name,
              date,
              total_working_hours: Number(previous.total_working_hours),
              overtime: Number(previous.overtime),
              overtime_status: previous.overtime_status,
              review_status: (previous as any).review_status || 'NONE',
              overtime_candidate_hours: Number(previous.overtime_candidate_hours),
              late_early: Number(previous.late_early),
              status: previous.attendance_status,
            })
          }
          continue
        }

        const previousDetails = previous?.calculation_details as Record<string, unknown> | null
        const changed = previousDetails?.fingerprint !== calculation.details.fingerprint || previous?.overtime_seconds !== calculation.overtimeSeconds || previous?.late_early_seconds !== calculation.lateEarlySeconds || previousDetails?.policy !== calculation.details.policy
        const invalidatedReview = Boolean(previous?.manual_adjustment && changed)
        const manual = previous?.manual_adjustment && !changed
        const pendingCandidate = manual ? Number(previous!.overtime_candidate_hours) : calculation.overtimeCandidateHours
        const pendingLateEarly = manual ? Number(previous!.late_early) : calculation.lateEarlyHours
        const hasOvertimeOrPenalty = pendingCandidate > 0 || pendingLateEarly > 0
        const isPending = calculation.requiresReview || hasOvertimeOrPenalty || Boolean(manual) || invalidatedReview || isEmployeeReopened
        const reviewStatus = isEmployeeReopened ? 'PENDING' : (isPending ? 'PENDING' : 'NONE')

        const data = {
          shift_id: assigned?.shift_id ?? null,
          first_check_in: calculation.first,
          last_check_out: calculation.last,
          total_working_hours: calculation.workingHours,
          late_early: manual ? previous!.late_early : calculation.lateEarlyHours,
          overtime: 0,
          regular_seconds: Math.round(calculation.regularSeconds),
          overtime_seconds: Math.round(calculation.overtimeSeconds),
          late_early_seconds: Math.round(calculation.lateEarlySeconds),
          overtime_candidate_hours: pendingCandidate,
          overtime_status: pendingCandidate > 0 ? 'PENDING' : 'NONE',
          overtime_reason: changed ? null : previous?.overtime_reason,
          review_status: reviewStatus,
          approved_by: null,
          approved_at: null,
          approval_source: null,
          approval_reason: null,
          pre_approval_snapshot: changed ? null : ((previous as any)?.pre_approval_snapshot ?? null),
          reopened_at: (previous as any)?.reopened_at ?? null,
          reopened_by: (previous as any)?.reopened_by ?? null,
          manual_adjustment: Boolean(manual),
          attendance_status: calculation.status,
          requires_review: manual ? previous!.requires_review : calculation.requiresReview || invalidatedReview,
          review_reason: manual ? previous!.review_reason : calculation.reviewReason || (invalidatedReview ? 'SOURCE_CHANGED_AFTER_REVIEW' : null),
          calculation_details: calculation.details,
          policy_version: calculation.details.policy,
        }
        if (changed && previous?.manual_adjustment) {
          invalidations.push({
            action: 'INVALIDATE_ATTENDANCE_REVIEW',
            target_table: 'daily_attendance_summary',
            record_id: String(previous.id),
            old_values: { overtime: Number(previous.overtime), late_early: Number(previous.late_early), reason: previous.overtime_reason },
            new_values: { reason: 'SOURCE_CHANGED', overtime: 0 },
          })
        }
        if (changed || Number(previous?.late_early) !== Number(data.late_early) || previous?.late_early_seconds !== data.late_early_seconds || Number(previous?.total_working_hours) !== Number(data.total_working_hours) || previousDetails?.details_version !== calculation.details.details_version || previous?.policy_version !== calculation.details.policy || previous?.attendance_status !== data.attendance_status || previous?.shift_id !== data.shift_id || (previous as any)?.review_status !== data.review_status) {
          pendingWrites.push({ employee_id: emp.id, work_date: date, ...data, updated_at: new Date().toISOString() })
        }
        const payroll = periodPayroll.find(p => p.employeeId === emp.id)
        const oldRate = payrollOverrides(payroll ?? null).fields.hourly_rate
        await syncDayAdjustments(tx, { ...data, employee_id: emp.id, work_date: workDate }, sourceHourlyRate(emp, first.slice(0, 7), payroll?.hourly_rate, Boolean(oldRate)), adjustmentPolicy?.absence_penalty_rate ?? null, adjustmentBatch)
        details.push({
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          date,
          total_working_hours: Number(data.total_working_hours),
          overtime: Number(data.overtime),
          overtime_status: data.overtime_status,
          review_status: data.review_status,
          overtime_candidate_hours: Number(data.overtime_candidate_hours),
          late_early: Number(data.late_early),
          status: data.attendance_status,
        })
      }
    }
    if (process.env.NODE_ENV === 'test' && process.env.RUN_BATCH_SQL_TESTS !== '1') for (const write of pendingWrites) {
      const { employee_id, work_date, updated_at, ...rest } = write as any
      await tx.daily_attendance_summary.upsert({
        where: { employee_id_work_date: { employee_id, work_date: new Date(`${work_date}T00:00:00Z`) } },
        create: { employee_id, work_date: new Date(`${work_date}T00:00:00Z`), ...rest },
        update: { ...rest, updated_at: new Date() },
      })
    }
    // One parametrized JSON batch avoids a DB round trip for every employee/day.
    if (typeof (tx as any).$executeRaw === 'function' && (process.env.NODE_ENV !== 'test' || process.env.RUN_BATCH_SQL_TESTS === '1')) {
      for (let offset = 0; offset < pendingWrites.length; offset += 250) {
        const columns = [
          ['employee_id','uuid'], ['work_date','date'], ['shift_id','integer'],
          ['first_check_in','timestamptz'], ['last_check_out','timestamptz'],
          ['total_working_hours','numeric'], ['late_early','numeric'], ['overtime','numeric'],
          ['regular_seconds','integer'], ['overtime_seconds','integer'], ['late_early_seconds','integer'],
          ['overtime_candidate_hours','numeric'], ['overtime_status','text'], ['overtime_reason','text'],
          ['review_status','text'], ['approval_source','text'], ['pre_approval_snapshot','jsonb'], ['approval_reason','text'],
          ['approved_by','text'], ['approved_at','timestamptz'], ['manual_adjustment','boolean'],
          ['attendance_status','text'], ['requires_review','boolean'], ['review_reason','text'],
          ['calculation_details','jsonb'], ['policy_version','text'], ['reopened_at','timestamptz'], ['reopened_by','text'],
          ['updated_at','timestamptz'],
        ] as const
        // Identifiers and SQL types come exclusively from the static whitelist above.
        const names = Prisma.raw(columns.map(([name]) => `"${name}"`).join(', '))
        const definitions = Prisma.raw(columns.map(([name, type]) => `"${name}" ${type}`).join(', '))
        const updates = Prisma.raw(columns.filter(([name]) => name !== 'employee_id' && name !== 'work_date').map(([name]) => `"${name}" = EXCLUDED."${name}"`).join(', '))
        const payload = JSON.stringify(pendingWrites.slice(offset, offset + 250))
        await tx.$executeRaw`INSERT INTO daily_attendance_summary (${names})
          SELECT ${names} FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(${definitions})
          ON CONFLICT (employee_id, work_date) DO UPDATE SET ${updates}`
      }
    }
    await flushAdjustmentBatch(tx, adjustmentBatch)
    if (invalidations.length) await tx.auditLog.createMany({ data: invalidations })
    return { month, year, totalSummaries: details.length, details }
  }

  if (tx) return runWithTx(tx)
  return prisma.$transaction(runWithTx, { timeout: 60000 })
}

