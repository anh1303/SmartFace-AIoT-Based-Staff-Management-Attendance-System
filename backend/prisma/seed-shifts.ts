import 'dotenv/config'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { STANDARD_SHIFT_CONFIGS } from '../src/modules/shifts/shift.queries.js'
import { vnDay } from '../src/modules/attendance/attendance.policy.js'
import { addDays, dateValue, datesInRange, dayKey, isMain, loadSeedState, markPayrollsStale, printCoverage, readSeedInput, shouldSkip, type SeedMode, type SeedRange } from './seed-utils.js'

const TYPES = ['OFFICE_HOURS', 'MORNING', 'AFTERNOON', 'OTHER', 'OFF'] as const
const time = (clock: string) => new Date(`1970-01-01T${clock}:00Z`)

type ScheduleEmployee = { id: string; createdAt: Date; department?: { department_code: string } | null; position?: { level: string } | null }

export function buildShiftPlan(employees: ScheduleEmployee[], range: SeedRange) {
  const ordered = [...employees].sort((a, b) => a.id.localeCompare(b.id))
  const itTeam = ordered.filter(e => e.department?.department_code === 'IT' && e.position?.level !== 'MANAGER')
  return employees.flatMap(employee => datesInRange(range)
    .filter(date => date >= vnDay(employee.createdAt))
    .map(date => {
      const weekday = dateValue(date).getUTCDay()
      const week = Math.floor((+dateValue(date) - +dateValue('2026-01-05')) / (7 * 86400000))
      let shift_type: typeof TYPES[number] = 'OFFICE_HOURS'
      if (weekday === 0 || weekday === 6) shift_type = 'OFF'
      else if (employee.position?.level !== 'MANAGER') {
        const department = employee.department?.department_code
        if (department === 'SALE' || department === 'CS') {
          const team = ordered.filter(e => e.department?.department_code === department && e.position?.level !== 'MANAGER')
          shift_type = (team.findIndex(e => e.id === employee.id) + week) % 2 === 0 ? 'MORNING' : 'AFTERNOON'
        } else if (department === 'IT') {
          const tuesday = addDays(date, 2 - weekday)
          const available = itTeam.filter(e => vnDay(e.createdAt) <= tuesday)
          const onCall = available.length ? available[((week % available.length) + available.length) % available.length] : undefined
          if (onCall?.id === employee.id) {
            if (weekday === 2) shift_type = 'OTHER'
            if (weekday === 3) shift_type = 'OFF'
          }
        }
      }
      return { employee_id: employee.id, date, shift_type }
    }))
}

export async function seedShifts(db: PrismaClient, range: SeedRange, mode: SeedMode) {
  return db.$transaction(async tx => {
    const state = await loadSeedState(tx, range)
    const plan = buildShiftPlan(state.employees, range)
    if (!plan.length) throw new Error('Không có nhân viên đã tuyển trong tháng đã chọn.')
    const counts: Record<string, number> = {}
    const result = { created: 0, replaced: 0, skipped: 0, protected: 0, counts }
    const catalog = await tx.work_shifts.findMany({ orderBy: { id: 'asc' } })
    const changed = new Set<string>()
    // Create only missing standard templates; keep existing catalog times intact.
    const catalogIds = new Map<string, number>()
    for (const type of TYPES) {
      const config = STANDARD_SHIFT_CONFIGS[type]
      const existing = catalog.find(s => s.shift_name.toLocaleLowerCase('vi') === config.name.toLocaleLowerCase('vi'))
      const shift = existing ?? await tx.work_shifts.create({ data: { shift_name: config.name, start_time: time(config.start_time), end_time: time(config.end_time) } })
      catalogIds.set(type, shift.id)
    }
    for (const item of plan) {
      const old = state.shifts.find(s => s.employee_id === item.employee_id && vnDay(s.work_date) === item.date)
      const protectedDay = state.isProtected(item.employee_id, item.date)
      if (shouldSkip(mode, Boolean(old), protectedDay)) {
        if (protectedDay) result.protected++
        else result.skipped++
        continue
      }
      // Respect an actual preserved night on the previous date, including month boundaries.
      const previous = state.shifts.find(s => s.employee_id === item.employee_id && vnDay(s.work_date) === addDays(item.date, -1))
      if (previous && previous.shift_type !== 'OFF' && previous.end_time < previous.start_time) item.shift_type = 'OFF'
      if (item.shift_type === 'OTHER') {
        const nextDate = addDays(item.date, 1)
        const next = state.shifts.find(s => s.employee_id === item.employee_id && vnDay(s.work_date) === nextDate)
        const cannotChangeNext = nextDate > range.to || state.isProtected(item.employee_id, nextDate) || (mode === 'skip' && Boolean(next))
        if (cannotChangeNext && next?.shift_type !== 'OFF') item.shift_type = 'OFFICE_HOURS'
      }
      const key = { employee_id: item.employee_id, work_date: dateValue(item.date) }
      if (old) {
        await tx.employee_shifts.deleteMany({ where: key })
        result.replaced++
      }
      const config = STANDARD_SHIFT_CONFIGS[item.shift_type]
      await tx.employee_shifts.create({ data: { ...key, shift_id: catalogIds.get(item.shift_type)!, shift_type: item.shift_type,
        work_day: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][dateValue(item.date).getUTCDay()],
        start_time: time(item.shift_type === 'OTHER' ? '22:00' : config.start_time),
        end_time: time(item.shift_type === 'OTHER' ? '06:00' : config.end_time),
        note: 'DEMO_SEED: lịch theo phòng ban/chức vụ; nghỉ cuối tuần và sau ca đêm',
      } })
      // Later days must use this newly written schedule rather than the overwritten snapshot.
      if (old) Object.assign(old, { shift_type: item.shift_type, start_time: time(item.shift_type === 'OTHER' ? '22:00' : config.start_time), end_time: time(item.shift_type === 'OTHER' ? '06:00' : config.end_time) })
      // Keep actual scans; the existing UI/aggregator can recalculate them under the new schedule.
      await tx.daily_attendance_summary.updateMany({ where: key, data: { requires_review: true, review_reason: 'SHIFT_CHANGED', review_status: 'PENDING' } })
      changed.add(dayKey(item.employee_id, item.date.slice(0, 7)))
      counts[item.shift_type] = (counts[item.shift_type] ?? 0) + 1
      result.created++
    }
    await markPayrollsStale(tx, state.payrolls, changed)
    return result
  }, { maxWait: 20000, timeout: 180000 })
}

if (isMain(import.meta.url)) {
  try {
    const input = await readSeedInput(true)
    if (input) {
      const result = await seedShifts(prisma, input.range, input.mode)
      console.log(`Phân ca ${input.range.from} → ${input.range.to}: ${result.created} bản ghi mới (thay ${result.replaced} ca cũ), bỏ qua ${result.skipped}, bảo vệ ${result.protected}.`)
      printCoverage(result.counts, TYPES)
    }
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { await prisma.$disconnect() }
}
