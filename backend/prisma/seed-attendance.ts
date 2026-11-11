import 'dotenv/config'
import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { calculateDay, shiftBounds, vnDay, type DatedPolicyShift, type PolicyLog } from '../src/modules/attendance/attendance.policy.js'
import { syncDayAdjustments, flushAdjustmentBatch } from '../src/modules/attendance/attendance.adjustments.js'
import { monthlyHourlyRate } from '../src/modules/employees/employee.wage.js'
import { policyForPeriod } from '../src/common/payroll-policy.js'
import { addDays, dateValue, dayKey, isMain, loadSeedState, markPayrollsStale, printCoverage, readSeedInput, seededRandom, shouldSkip, type SeedMode, type SeedRange } from './seed-utils.js'

export const WORK_CASES = ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'LATE_AND_EARLY', 'ABSENT', 'MISSING_IN', 'MISSING_OUT',
  'UNDER_MINIMUM', 'MULTIPLE_PAIRS', 'REPEATED_IN', 'FLAGGED', 'OT_BELOW_THRESHOLD', 'OVERTIME', 'OT_OVER_LIMIT'] as const
type Scenario = typeof WORK_CASES[number] | 'OFF_REST' | 'OFF_WORK'
const MINUTE = 60000

// Percentages among working employee-days; OFF days are modeled separately.
export const CASE_WEIGHTS: Record<typeof WORK_CASES[number], number> = {
  ON_TIME: 70, LATE: 10, EARLY_LEAVE: 5, LATE_AND_EARLY: 2, ABSENT: 3,
  MISSING_IN: 1.5, MISSING_OUT: 1.5, OVERTIME: 4.8, OT_OVER_LIMIT: 0.2,
  UNDER_MINIMUM: 0.4, MULTIPLE_PAIRS: 0.4, REPEATED_IN: 0.4, FLAGGED: 0.4, OT_BELOW_THRESHOLD: 0.4,
}

export function chooseScenario(key: string, off: boolean): Scenario {
  const draw = seededRandom(`scenario:${key}`)() * 100
  if (off) return draw < 2 ? 'OFF_WORK' : 'OFF_REST'
  let cumulative = 0
  for (const [scenario, weight] of Object.entries(CASE_WEIGHTS)) {
    cumulative += weight
    if (draw < cumulative) return scenario as Scenario
  }
  return 'ON_TIME'
}

export function buildScenarioLogs(date: string, shift: DatedPolicyShift, scenario: Scenario, key = `${date}:${scenario}`): PolicyLog[] {
  const { start, end } = shiftBounds(date, shift)
  const duration = +end - +start
  const random = seededRandom(`times:${key}:${scenario}`)
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const arrival = +start - between(0, 10 * 60) * 1000
  const departure = +end + between(0, 10 * 60) * 1000
  // Keep ordinary late/early cases above the minimum-work threshold, even on half-day shifts.
  const penaltyLimit = Math.floor(duration / 6 / 1000)
  const late = between(16 * 60, Math.max(16 * 60, Math.min((random() < 0.85 ? 25 : 45) * 60, penaltyLimit))) * 1000
  const early = between(5 * 60, Math.max(5 * 60, Math.min((random() < 0.85 ? 15 : 30) * 60, penaltyLimit))) * 1000
  const event = (at: number, type: string, status = 'VALID'): PolicyLog => ({ id: 0, type, event_time: new Date(at), status, method: 'FACE', device_info: `DEMO_SEED:${scenario}` })
  const pair = (from = arrival, to = departure) => [event(from, 'CHECK_IN'), event(to, 'CHECK_OUT')]
  let logs: PolicyLog[]
  switch (scenario) {
    case 'ABSENT': case 'OFF_REST': logs = []; break
    case 'OFF_WORK': {
      const from = +new Date(`${date}T14:00:00+07:00`) + between(0, 30 * 60) * 1000
      logs = pair(from, from + between(60 * 60, 150 * 60) * 1000); break
    }
    case 'LATE': logs = pair(+start + late); break
    case 'EARLY_LEAVE': logs = pair(arrival, +end - early); break
    case 'LATE_AND_EARLY': logs = pair(+start + late, +end - early); break
    case 'MISSING_IN': logs = [event(departure, 'CHECK_OUT')]; break
    case 'MISSING_OUT': logs = [event(arrival, 'CHECK_IN')]; break
    case 'UNDER_MINIMUM': logs = pair(arrival, +start + Math.floor(duration * (0.2 + random() * 0.2))); break
    case 'MULTIPLE_PAIRS': logs = [...pair(arrival, +start + duration / 2), ...pair(+start + duration / 2 + between(10, 25) * MINUTE, departure)]; break
    case 'REPEATED_IN': logs = [event(arrival - between(5, 30) * 1000, 'CHECK_IN'), ...pair()]; break
    case 'FLAGGED': logs = [event(arrival, 'CHECK_IN', 'INVALID'), event(departure, 'CHECK_OUT')]; break
    case 'OT_BELOW_THRESHOLD': logs = pair(arrival, +end + between(60, 29 * 60) * 1000); break
    case 'OVERTIME': logs = pair(arrival, +end + between(31 * 60, random() < 0.8 ? 90 * 60 : 120 * 60) * 1000); break
    case 'OT_OVER_LIMIT': logs = pair(arrival, +end + between(241 * 60, 300 * 60) * 1000); break
    default: logs = pair()
  }
  return logs.map((log, index) => ({ ...log, id: index + 1 }))
}

export async function seedAttendance(db: PrismaClient, range: SeedRange, mode: SeedMode, now = new Date()) {
  if (range.from > vnDay(now)) throw new Error('Không tạo lượt chấm công trong tương lai.')
  return db.$transaction(async tx => {
    const state = await loadSeedState(tx, range)
    const assignments = state.shifts.filter(s => {
      const date = vnDay(s.work_date)
      const employee = state.employees.find(e => e.id === s.employee_id)!
      return date >= range.from && date <= range.to && date >= vnDay(employee.createdAt)
    }).sort((a, b) => vnDay(a.work_date).localeCompare(vnDay(b.work_date)) || a.employee_id.localeCompare(b.employee_id))
    if (!assignments.length) throw new Error('Không có lịch phân ca phù hợp trong khoảng đã chọn. Chạy seed phân ca trước.')
    const counts: Record<string, number> = {}
    const result = { days: 0, logs: 0, replaced: 0, skipped: 0, protected: 0, unfinished: 0, counts }
    const plans: Array<{ assignment: typeof assignments[number]; date: string; scenario: Scenario; logs: PolicyLog[] }> = []
    for (const assignment of assignments) {
      const date = vnDay(assignment.work_date)
      const protectedDay = state.isProtected(assignment.employee_id, date)
      const exists = state.existingAttendance.has(dayKey(assignment.employee_id, date))
      if (shouldSkip(mode, exists, protectedDay)) {
        if (protectedDay) result.protected++
        else result.skipped++
        continue
      }
      const bounds = shiftBounds(date, assignment)
      if (date > vnDay(now) || +bounds.end > +now || (!bounds.off && bounds.isZeroDuration)) { result.unfinished++; continue }
      const key = dayKey(assignment.employee_id, date)
      const previous = state.shifts.find(s => s.employee_id === assignment.employee_id && vnDay(s.work_date) === addDays(date, -1))
      const recovering = bounds.off && previous && previous.shift_type !== 'OFF' && previous.end_time < previous.start_time
      let scenario: Scenario = recovering ? 'OFF_REST' : chooseScenario(key, bounds.off)
      let logs = buildScenarioLogs(date, assignment, scenario, key)
      // Do not truncate a case and silently turn it into an unrelated missing-scan case.
      if (!bounds.off && (logs.some(l => +new Date(l.event_time) > +now) || +bounds.end - +bounds.start < 3 * 3600000 || +bounds.end - +bounds.start > 19 * 3600000)) {
        scenario = 'ON_TIME'
        logs = buildScenarioLogs(date, assignment, scenario, key)
      }
      if (logs.some(l => +new Date(l.event_time) > +now)) { result.unfinished++; continue }
      if (exists) result.replaced++
      plans.push({ assignment, date, scenario, logs })
    }
    const deletedIds = new Set<string>()
    const changed = new Set<string>()
    const writes: Prisma.attendance_logsCreateManyInput[] = []
    for (const plan of plans) {
      const employee_id = plan.assignment.employee_id
      const key = { employee_id, work_date: dateValue(plan.date) }
      const oldIds = state.logs.filter(l => l.employee_id === employee_id && state.ownership.get(String(l.id)) === plan.date).map(l => l.id)
      oldIds.forEach(id => deletedIds.add(String(id)))
      await tx.attendanceAdjustment.deleteMany({ where: key })
      await tx.daily_attendance_summary.deleteMany({ where: key })
      if (oldIds.length) await tx.attendance_logs.deleteMany({ where: { id: { in: oldIds } } })
      for (const [index, log] of plan.logs.entries()) {
        writes.push({ ...key, event_time: new Date(log.event_time), type: log.type, status: log.status, method: 'FACE',
          device_info: log.device_info, event_key: createHash('sha256').update(`demo:${employee_id}:${plan.date}:${plan.scenario}:${index}`).digest('hex'),
        })
      }
      changed.add(dayKey(employee_id, plan.date.slice(0, 7)))
    }
    for (let i = 0; i < writes.length; i += 1000) await tx.attendance_logs.createMany({ data: writes.slice(i, i + 1000) })
    const inserted: typeof state.logs = []
    for (let i = 0; i < writes.length; i += 1000) inserted.push(...await tx.attendance_logs.findMany({ where: { event_key: { in: writes.slice(i, i + 1000).map(w => w.event_key!) } } }))
    const allLogs = [...state.logs.filter(l => !deletedIds.has(String(l.id))), ...inserted]
    const summaryWrites: Prisma.daily_attendance_summaryCreateManyInput[] = []
    const adjustmentBatch = { existing: new Map(), writes: [] as Prisma.AttendanceAdjustmentCreateManyInput[], audits: [] as Prisma.AuditLogCreateManyInput[] }
    const policies = new Map<string, Awaited<ReturnType<typeof policyForPeriod>>>()
    for (const plan of plans) {
      const employee = state.employees.find(e => e.id === plan.assignment.employee_id)!
      const employeeShifts = state.shifts.filter(s => s.employee_id === employee.id)
      const calculation = calculateDay(plan.date, allLogs.filter(l => l.employee_id === employee.id), plan.assignment, now, employeeShifts)
      const pending = calculation.requiresReview || calculation.overtimeCandidateHours > 0 || calculation.lateEarlyHours > 0 || calculation.absenceCandidate
      const summary = { employee_id: employee.id, work_date: dateValue(plan.date), shift_id: plan.assignment.shift_id,
        first_check_in: calculation.first, last_check_out: calculation.last, total_working_hours: calculation.workingHours,
        late_early: calculation.lateEarlyHours, overtime: 0, regular_seconds: Math.round(calculation.regularSeconds),
        overtime_seconds: Math.round(calculation.overtimeSeconds), late_early_seconds: Math.round(calculation.lateEarlySeconds),
        overtime_candidate_hours: calculation.overtimeCandidateHours, overtime_status: calculation.overtimeCandidateHours > 0 ? 'PENDING' : 'NONE',
        attendance_status: calculation.status, requires_review: calculation.requiresReview, review_reason: calculation.reviewReason,
        review_status: pending ? 'PENDING' : 'NONE', calculation_details: calculation.details, policy_version: calculation.details.policy,
      }
      summaryWrites.push(summary)
      const period = plan.date.slice(0, 7)
      if (!policies.has(period)) policies.set(period, await policyForPeriod(period, tx))
      await syncDayAdjustments(tx, summary, monthlyHourlyRate(employee, period), policies.get(period)?.absence_penalty_rate ?? null, adjustmentBatch)
      counts[plan.scenario] = (counts[plan.scenario] ?? 0) + 1
      if (vnDay(shiftBounds(plan.date, plan.assignment).end) !== plan.date && plan.assignment.shift_type !== 'OFF') counts.OVERNIGHT = (counts.OVERNIGHT ?? 0) + 1
    }
    for (let i = 0; i < summaryWrites.length; i += 250) await tx.daily_attendance_summary.createMany({ data: summaryWrites.slice(i, i + 250) })
    await flushAdjustmentBatch(tx, adjustmentBatch)
    await markPayrollsStale(tx, state.payrolls, changed)
    result.days = plans.length
    result.logs = writes.length
    return result
  }, { maxWait: 20000, timeout: 180000 })
}

if (isMain(import.meta.url)) {
  try {
    const input = await readSeedInput(false)
    if (input) {
      const result = await seedAttendance(prisma, input.range, input.mode)
      console.log(`Chấm công ${input.range.from} → ${input.range.to}: ${result.days} ngày công, ${result.logs} lượt quét; thay ${result.replaced}, bỏ qua ${result.skipped}, bảo vệ ${result.protected}, ca chưa kết thúc/không có giờ ${result.unfinished}.`)
      printCoverage(result.counts, [...WORK_CASES, 'OFF_REST', 'OFF_WORK', 'OVERNIGHT'], CASE_WEIGHTS)
    }
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { await prisma.$disconnect() }
}
