import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { seedShifts } from '../../prisma/seed-shifts.js'
import { chooseScenario, seedAttendance } from '../../prisma/seed-attendance.js'

// In-memory Prisma boundary: exercise the actual transaction/seed code without a live DB.
function fixture() {
  const clock = (s: string) => new Date(`1970-01-01T${s}:00Z`)
  const day = (s: string) => new Date(`${s}T00:00:00Z`)
  const template = { id: 1, shift_name: 'Ca Hành Chính', start_time: clock('08:00'), end_time: clock('17:00') }
  const rows: Record<string, any[]> = {
    employee: [{ id: 'e1', employee_code: 'NV-001', createdAt: day('2026-01-01'), status: 'ACTIVE', hourly_rate: 100000, hourly_rate_history: [] }],
    work_shifts: [template],
    employee_shifts: ['2026-11-01', '2026-11-02', '2026-11-03'].map((date, i) => ({ id: BigInt(i + 1), employee_id: 'e1', work_date: day(date), shift_id: 1, shift_type: 'OFFICE_HOURS', start_time: clock('08:00'), end_time: clock('17:00'), work_shifts: template })),
    attendance_logs: [], daily_attendance_summary: [], attendanceAdjustment: [], attendance_locks: [], payrollRecord: [], bonusPenalty: [],
  }
  const scalar = (v: any) => v instanceof Date ? +v : v
  function matches(row: any, where: any = {}): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((entry: any) => matches(row, entry))
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.entries(value).every(([op, other]: [string, any]) => {
          const actual = scalar(row[key]), expected = scalar(other)
          if (op === 'in') return other.includes(row[key])
          if (op === 'gte') return actual >= expected
          if (op === 'lte') return actual <= expected
          if (op === 'lt') return actual < expected
          return false
        })
      }
      return scalar(row[key]) === scalar(value)
    })
  }
  let nextId = 100n
  const db: any = { $executeRaw: async () => 0 }
  for (const name of Object.keys(rows)) {
    const create = async ({ data }: any) => {
      const record = { id: ++nextId, ...data }
      rows[name].push(record)
      return record
    }
    db[name] = {
      findMany: async ({ where }: any = {}) => rows[name].filter(row => matches(row, where)),
      findFirst: async ({ where }: any = {}) => rows[name].find(row => matches(row, where)) ?? null,
      create,
      createMany: async ({ data }: any) => { for (const item of data) await create({ data: item }) },
      deleteMany: async ({ where }: any) => { rows[name] = rows[name].filter(row => !matches(row, where)) },
      updateMany: async ({ where, data }: any) => { for (const row of rows[name]) if (matches(row, where)) Object.assign(row, data) },
      update: async ({ where, data }: any) => Object.assign(rows[name].find(row => matches(row, where)), data),
    }
  }
  db.$transaction = async (callback: any) => {
    const snapshot = structuredClone(rows)
    try { return await callback(db) }
    catch (error) { Object.assign(rows, snapshot); throw error }
  }
  function addLogs(date: string) {
    rows.attendance_logs.push(...['CHECK_IN', 'CHECK_OUT'].map((type, i) => ({
      id: ++nextId, employee_id: 'e1', work_date: day(date), type,
      event_time: new Date(`${date}T${i ? '17' : '08'}:00:00+07:00`), status: 'VALID', method: 'FACE', event_key: `existing:${date}:${type}`,
    })))
  }
  return { db: db as PrismaClient, rows, addLogs, day }
}

const range = { from: '2026-11-02', to: '2026-11-02' }
const now = new Date('2026-11-05T00:00:00Z')

describe('seed persistence and replacement', () => {
  it('skip leaves existing raw attendance untouched and does not fill half of the employee-day', async () => {
    const { db, rows, addLogs } = fixture()
    addLogs(range.from)
    const previous = structuredClone(rows.attendance_logs)
    const result = await seedAttendance(db, range, 'skip', now)
    expect(result.skipped).toBe(1)
    expect(rows.attendance_logs).toEqual(previous)
    expect(rows.daily_attendance_summary).toEqual([])
  })
  it('overwrite replaces selected scans and summary, keeps neighboring days and invalidates pending payroll', async () => {
    const { db, rows, addLogs } = fixture()
    addLogs('2026-11-01'); addLogs(range.from); addLogs('2026-11-03')
    const neighbors = rows.attendance_logs.filter(row => row.work_date.toISOString().slice(0, 10) !== range.from)
    rows.payrollRecord.push({ id: 1n, employeeId: 'e1', payroll_period: '2026-11', status: 'PENDING', calculation_details: { note: 'keep' } })
    const result = await seedAttendance(db, range, 'overwrite', now)
    expect(result.replaced).toBe(1)
    expect(result.logs).toBe(2)
    expect(rows.attendance_logs.filter(row => row.event_key.startsWith('existing:'))).toEqual(neighbors)
    expect(rows.daily_attendance_summary).toHaveLength(1)
    expect(rows.daily_attendance_summary[0].attendance_status).toBe('PRESENT')
    expect(rows.payrollRecord[0].calculation_details).toMatchObject({ note: 'keep', needs_recalculation: true })
  })
  it.each(['lock', 'review', 'payroll'])('preserves protected %s days in both seed operations', async kind => {
    const { db, rows, addLogs, day } = fixture()
    addLogs(range.from)
    if (kind === 'lock') rows.attendance_locks.push({ work_date: day(range.from), is_locked: true })
    if (kind === 'review') rows.daily_attendance_summary.push({ employee_id: 'e1', work_date: day(range.from), review_status: 'APPROVED' })
    if (kind === 'payroll') rows.payrollRecord.push({ employeeId: 'e1', payroll_period: '2026-11', status: 'FINALIZED' })
    const before = structuredClone(rows.attendance_logs)
    expect((await seedAttendance(db, range, 'overwrite', now)).protected).toBe(1)
    expect((await seedShifts(db, range, 'overwrite')).protected).toBe(1)
    expect(rows.attendance_logs).toEqual(before)
    expect(rows.employee_shifts).toHaveLength(3)
  })
  it('skip recognizes absent days from summaries, even with zero scans', async () => {
    const { db, rows, day } = fixture()
    rows.daily_attendance_summary.push({ employee_id: 'e1', work_date: day(range.from), attendance_status: 'ABSENT' })
    expect((await seedAttendance(db, range, 'skip', now)).skipped).toBe(1)
    expect(rows.attendance_logs).toEqual([])
  })
  it('does not generate future scans or open shifts', async () => {
    const { db, rows } = fixture()
    const result = await seedAttendance(db, range, 'overwrite', new Date('2026-11-02T09:00:00+07:00'))
    expect(result.unfinished).toBe(1)
    expect(rows.attendance_logs).toEqual([])
    expect(rows.daily_attendance_summary).toEqual([])
  })
  it('does not turn future OFF_WORK events into a zero-duration midnight pair', async () => {
    const { db, rows } = fixture()
    const offWorker = Array.from({ length: 1000 }, (_, i) => `off-${i}`).find(id => chooseScenario(`${id}:${range.from}`, true) === 'OFF_WORK')!
    rows.employee.push({ ...rows.employee[0], id: offWorker, employee_code: 'NV-002' })
    const off = { ...rows.employee_shifts[1], shift_type: 'OFF', start_time: new Date('1970-01-01T00:00:00Z'), end_time: new Date('1970-01-01T00:00:00Z') }
    rows.employee_shifts = [off, { ...off, id: 20n, employee_id: offWorker }]
    const result = await seedAttendance(db, range, 'overwrite', new Date('2026-11-02T09:00:00+07:00'))
    expect(result.unfinished).toBe(1)
    expect(rows.attendance_logs).toEqual([])
    expect(rows.daily_attendance_summary).toHaveLength(1)
  })
  it('never generates rest-day work immediately after an actual night shift', async () => {
    const { db, rows } = fixture()
    const id = Array.from({ length: 1000 }, (_, i) => `off-${i}`).find(id => chooseScenario(`${id}:${range.from}`, true) === 'OFF_WORK')!
    rows.employee[0].id = id
    for (const shift of rows.employee_shifts) shift.employee_id = id
    Object.assign(rows.employee_shifts[0], { shift_type: 'OTHER', start_time: new Date('1970-01-01T22:00:00Z'), end_time: new Date('1970-01-01T06:00:00Z') })
    Object.assign(rows.employee_shifts[1], { shift_type: 'OFF', start_time: new Date('1970-01-01T00:00:00Z'), end_time: new Date('1970-01-01T00:00:00Z') })
    const result = await seedAttendance(db, range, 'overwrite', now)
    expect(result.counts.OFF_REST).toBe(1)
    expect(rows.attendance_logs).toEqual([])
  })
  it('preserves a previous overnight checkout physically inside the selected calendar day', async () => {
    const { db, rows } = fixture()
    Object.assign(rows.employee_shifts[0], { shift_type: 'OTHER', start_time: new Date('1970-01-01T22:00:00Z'), end_time: new Date('1970-01-01T06:00:00Z') })
    rows.attendance_logs = [
      { id: 10n, employee_id: 'e1', work_date: null, type: 'CHECK_IN', event_time: new Date('2026-11-01T22:00:00+07:00'), status: 'VALID' },
      { id: 11n, employee_id: 'e1', work_date: null, type: 'CHECK_OUT', event_time: new Date('2026-11-02T06:00:00+07:00'), status: 'VALID' },
    ]
    const previous = structuredClone(rows.attendance_logs)
    await seedAttendance(db, range, 'overwrite', now)
    expect(rows.attendance_logs.filter(row => row.id === 10n || row.id === 11n)).toEqual(previous)
  })
  it('rolls back deletes when the later summary write fails', async () => {
    const { db, rows, addLogs } = fixture()
    addLogs(range.from)
    const before = structuredClone(rows.attendance_logs)
    db.daily_attendance_summary.createMany = async () => { throw new Error('simulated write failure') }
    await expect(seedAttendance(db, range, 'overwrite', now)).rejects.toThrow('simulated write failure')
    expect(rows.attendance_logs).toEqual(before)
  })
  it('replaces only selected assignments and preserves actual scans for recalculation', async () => {
    const { db, rows, addLogs, day } = fixture()
    addLogs(range.from)
    rows.daily_attendance_summary.push({ employee_id: 'e1', work_date: day(range.from), review_status: 'NONE' })
    const scans = structuredClone(rows.attendance_logs)
    const result = await seedShifts(db, range, 'overwrite')
    expect(result.replaced).toBe(1)
    expect(rows.employee_shifts).toHaveLength(3)
    expect(rows.attendance_logs).toEqual(scans)
    expect(rows.daily_attendance_summary[0].review_reason).toBe('SHIFT_CHANGED')
    expect((await seedShifts(db, range, 'skip')).skipped).toBe(1)
  })
  it('does not introduce a night before a protected working day that cannot become recovery leave', async () => {
    const { db, rows, day } = fixture()
    Object.assign(rows.employee[0], { department: { department_code: 'IT' }, position: { level: 'EMPLOYEE' } })
    rows.employee_shifts.push({ ...rows.employee_shifts[1], id: 99n, work_date: day('2026-11-04') })
    rows.daily_attendance_summary.push({ employee_id: 'e1', work_date: day('2026-11-04'), review_status: 'APPROVED' })
    await seedShifts(db, { from: '2026-11-02', to: '2026-11-04' }, 'overwrite')
    const tuesday = rows.employee_shifts.find(s => s.work_date.toISOString().slice(0, 10) === '2026-11-03')
    expect(tuesday.shift_type).toBe('OFFICE_HOURS')
  })
})
