import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { workDateSchema } from '../src/common/date.schema.js'
import { prepareAttendance, vnDay, type DatedPolicyShift, type PolicyLog } from '../src/modules/attendance/attendance.policy.js'

export type SeedMode = 'overwrite' | 'skip'
export type SeedRange = { from: string; to: string }
export const dateValue = (date: string) => new Date(`${date}T00:00:00Z`)
export const addDays = (date: string, count: number) => new Date(+dateValue(date) + count * 86400000).toISOString().slice(0, 10)

// Stable per employee/date: rerunning another range does not reshuffle existing scenarios.
export function seededRandom(key: string) {
  let seed = createHash('sha256').update(key).digest().readUInt32LE(0)
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

export function parseRange(values: string[], monthOnly = false): SeedRange {
  let [from, to] = values
  if (values.length === 1 && /^\d{4}-\d{2}$/.test(from)) {
    workDateSchema.parse(`${from}-01`)
    const [year, month] = from.split('-').map(Number)
    to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    from += '-01'
  } else {
    if (monthOnly || values.length < 1 || values.length > 2) throw new Error('Nhập tháng YYYY-MM, ngày YYYY-MM-DD hoặc hai ngày bắt đầu/kết thúc.')
    workDateSchema.parse(from)
    to ??= from
    workDateSchema.parse(to)
  }
  if (from > to || +dateValue(to) - +dateValue(from) > 365 * 86400000) throw new Error('Khoảng ngày phải tăng dần và không dài quá 366 ngày.')
  return { from, to }
}

export function datesInRange(range: SeedRange): string[] {
  const result: string[] = []
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) result.push(day)
  return result
}

export async function readSeedInput(monthOnly: boolean): Promise<{ range: SeedRange; mode: SeedMode } | null> {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(monthOnly
      ? 'npm run prisma:seed:shifts -- [YYYY-MM] [--mode overwrite|skip]'
      : 'npm run prisma:seed:attendance -- [YYYY-MM | YYYY-MM-DD | YYYY-MM-DD YYYY-MM-DD] [--mode overwrite|skip]')
    console.log('Bỏ tham số để nhập trên terminal. overwrite: xóa/tạo lại; skip: giữ ngày đã có dữ liệu. Ngày khóa/đã duyệt hoặc lương đã chốt luôn được giữ.')
    return null
  }
  const modeIndex = args.indexOf('--mode')
  let mode = modeIndex < 0 ? undefined : args.splice(modeIndex, 2)[1]
  if (modeIndex >= 0 && !mode) throw new Error('--mode cần overwrite hoặc skip.')
  const prompt = createInterface({ input: stdin, output: stdout })
  try {
    const input = args.length ? args : (await prompt.question(monthOnly
      ? 'Tháng phân ca (YYYY-MM): '
      : 'Tháng / ngày / khoảng ngày (YYYY-MM | YYYY-MM-DD | YYYY-MM-DD YYYY-MM-DD): ')).trim().split(/\s+/)
    const range = parseRange(input, monthOnly)
    mode ??= await prompt.question('Dữ liệu đã có: 1. Xóa và tạo lại  2. Bỏ qua — chọn 1 hoặc 2: ')
    if (mode === '1') mode = 'overwrite'
    if (mode === '2') mode = 'skip'
    if (mode !== 'overwrite' && mode !== 'skip') throw new Error('Chế độ phải là 1/overwrite hoặc 2/skip.')
    return { range, mode }
  } finally { prompt.close() }
}

export const isMain = (url: string) => Boolean(process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href)
export const shouldSkip = (mode: SeedMode, exists: boolean, protectedDay: boolean) => protectedDay || (mode === 'skip' && exists)
export const dayKey = (employee: string, date: string) => `${employee}:${date}`

// Pair both sides before falling back to single-event ownership, including legacy null work_date.
export function ownedLogDates(logs: Array<PolicyLog & { work_date?: Date | null }>, shifts: DatedPolicyShift[]) {
  const prepared = prepareAttendance(logs, shifts)
  const paired = new Map(prepared.pairing.pairs.flatMap(pair => [[pair.inId, pair.workDate], [pair.outId, pair.workDate]] as [string, string][]))
  return new Map(logs.map(log => [String(log.id), log.work_date ? vnDay(log.work_date) : paired.get(String(log.id)) ?? prepared.workDate(log.event_time)]))
}

export async function loadSeedState(tx: Prisma.TransactionClient, range: SeedRange) {
  const dates = datesInRange(range)
  // Same period locks used by attendance aggregation and payroll; take them in date order.
  const periods = [...new Set(datesInRange({ from: addDays(range.from, -2), to: addDays(range.to, 2) }).map(d => d.slice(0, 7)))].sort()
  for (const period of periods) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
  const employees = await tx.employee.findMany({ where: { status: 'ACTIVE' }, include: { department: true, position: true }, orderBy: { employee_code: 'asc' } })
  if (!employees.length) throw new Error('Không có nhân viên ACTIVE trong DB. Hãy tạo dữ liệu nền trước.')
  const ids = employees.map(e => e.id)
  const work_date = { gte: dateValue(range.from), lte: dateValue(range.to) }
  const [shifts, logs, summaries, adjustments, locks, payrolls] = await Promise.all([
    tx.employee_shifts.findMany({ where: { employee_id: { in: ids }, work_date: { gte: dateValue(addDays(range.from, -2)), lte: dateValue(addDays(range.to, 2)) } }, include: { work_shifts: true }, orderBy: { work_date: 'asc' } }),
    tx.attendance_logs.findMany({ where: { employee_id: { in: ids }, OR: [
      { work_date }, { event_time: { gte: new Date(`${addDays(range.from, -2)}T00:00:00+07:00`), lt: new Date(`${addDays(range.to, 3)}T00:00:00+07:00`) } },
    ] }, orderBy: [{ event_time: 'asc' }, { id: 'asc' }] }),
    tx.daily_attendance_summary.findMany({ where: { employee_id: { in: ids }, work_date } }),
    tx.attendanceAdjustment.findMany({ where: { employee_id: { in: ids }, work_date } }),
    tx.attendance_locks.findMany({ where: { work_date, is_locked: true } }),
    tx.payrollRecord.findMany({ where: { employeeId: { in: ids }, payroll_period: { in: periods } } }),
  ])
  const effectiveShifts = shifts.map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
  const ownership = new Map<string, string>()
  for (const employee of employees) {
    for (const [id, date] of ownedLogDates(logs.filter(l => l.employee_id === employee.id), effectiveShifts.filter(s => s.employee_id === employee.id))) ownership.set(id, date)
  }
  const existingAttendance = new Set([
    ...logs.map(l => dayKey(l.employee_id, ownership.get(String(l.id))!)),
    ...summaries.map(s => dayKey(s.employee_id, vnDay(s.work_date))),
    ...adjustments.map(s => dayKey(s.employee_id, vnDay(s.work_date))),
  ])
  const lockedDates = new Set(locks.map(l => vnDay(l.work_date)))
  const reviewed = new Set([
    ...summaries.filter(s => s.review_status === 'APPROVED' || s.manual_adjustment).map(s => dayKey(s.employee_id, vnDay(s.work_date))),
    ...adjustments.filter(a => a.reviewed_at || ['APPROVED', 'REJECTED'].includes(a.status)).map(a => dayKey(a.employee_id, vnDay(a.work_date))),
  ])
  const isProtected = (employee: string, date: string) => lockedDates.has(date) || reviewed.has(dayKey(employee, date)) ||
    payrolls.some(p => p.employeeId === employee && p.payroll_period === date.slice(0, 7) && p.status !== 'PENDING')
  return { dates, employees, shifts: effectiveShifts, logs, ownership, summaries, payrolls, existingAttendance, isProtected }
}

export async function markPayrollsStale(tx: Prisma.TransactionClient, payrolls: Awaited<ReturnType<typeof loadSeedState>>['payrolls'], changed: Set<string>) {
  for (const payroll of payrolls) {
    if (payroll.status !== 'PENDING' || !changed.has(dayKey(payroll.employeeId, payroll.payroll_period))) continue
    const details = payroll.calculation_details
    await tx.payrollRecord.update({ where: { id: payroll.id }, data: { calculation_details: {
      ...(details && typeof details === 'object' && !Array.isArray(details) ? details : {}),
      needs_recalculation: true, recompute_reason: 'DEMO_SEED_SOURCE_CHANGED',
    } } })
  }
}

export function printCoverage(counts: Record<string, number>, expected: readonly string[], weights?: Record<string, number>) {
  const workingDays = weights ? Object.keys(weights).reduce((sum, type) => sum + (counts[type] ?? 0), 0) : 0
  console.table(expected.map(type => ({ 'Loại / trường hợp': type, 'Số lượng': counts[type] ?? 0,
    ...(weights && type in weights ? { 'Mục tiêu %': weights[type], 'Thực tế %': workingDays ? Number(((counts[type] ?? 0) * 100 / workingDays).toFixed(2)) : 0 } : {}),
  })))
  const missing = expected.filter(type => !counts[type])
  if (missing.length) console.log(`Chưa tạo được: ${missing.join(', ')}. Cần thêm nhân viên/ngày/ca phù hợp hoặc chọn overwrite cho dữ liệu chưa khóa.`)
}
