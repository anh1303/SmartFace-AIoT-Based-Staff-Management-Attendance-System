import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)

;(enabled ? describe : describe.skip)('attendance with representative Neon data', () => {
  let db: any, attendance: any, shifts: any, admin: any
  let loadEmployees: any[]
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T12:00:00+07:00'))
    db = (await import('../../src/config/database.js')).prisma
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    shifts = await import('../../src/modules/shifts/shift.service.js')
    await ensureTestPayrollPolicy(db)
    const role = await db.roles.findUnique({ where: { role_name: 'ADMIN' } })
    admin = await db.user.create({ data: { username: `scale-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: role.id } })
  })
  afterAll(async () => { vi.useRealTimers(); if (db) await db.$disconnect() })

  it('finds old records outside the newest 50,000 by the selected date', async () => {
    const employee = await db.employee.create({ data: { employee_code: `OLD-${randomUUID().slice(0,8)}`, full_name: 'Old scans' } })
    const old = await db.attendance_logs.create({ data: { employee_id: employee.id, event_time: new Date('2026-09-01T01:00:00Z'), type: 'CHECK_IN' } })
    await db.$executeRaw`INSERT INTO attendance_logs (employee_id, event_time, type)
      SELECT ${employee.id}::uuid, '2026-10-01T00:00:00Z'::timestamptz + i * interval '1 second', 'CHECK_IN'
      FROM generate_series(1, 50001) AS i`
    expect(await db.attendance_logs.count({ where: { event_time: { gt: old.event_time } } })).toBeGreaterThan(50000)
    const rows = await attendance.list({ startDate: '2026-09-01', endDate: '2026-09-01' }, { id: admin.id, role: 'ADMIN' })
    expect(rows.map((r: any) => String(r.id))).toContain(String(old.id))
  })

  it('measures five simultaneous shift changes with 100 employees and 1,000 scans', async () => {
    const prefix = randomUUID().slice(0, 8)
    await db.employee.createMany({ data: Array.from({ length: 100 }, (_, i) => ({ employee_code: `LOAD-${prefix}-${i}`, full_name: `Load ${i}`, createdAt: new Date('2026-10-01T00:00:00Z') })) })
    const employees = await db.employee.findMany({ where: { employee_code: { startsWith: `LOAD-${prefix}-` } } })
    loadEmployees = employees
    await db.attendance_logs.createMany({ data: employees.flatMap((employee: any) => Array.from({ length: 10 }, (_, i) => ({
      employee_id: employee.id, type: i % 2 ? 'CHECK_OUT' : 'CHECK_IN',
      event_time: new Date(`2026-10-20T${String(8 + i).padStart(2, '0')}:00:00+07:00`),
      work_date: new Date('2026-10-20T00:00:00Z'),
    }))) })
    expect(employees).toHaveLength(100)
    expect(await db.attendance_logs.count({ where: { employee_id: { in: employees.map((e: any) => e.id) } } })).toBe(1000)
    const started = performance.now()
    const timings = await Promise.all(employees.slice(0, 5).map(async (employee: any) => {
      const start = performance.now()
      await shifts.assignOrUpdate({ employee_id: employee.id, date: '2026-10-20', shift_type: 'OFFICE_HOURS' }, admin.id, 'ADMIN')
      return Math.round(performance.now() - start)
    }))
    const measurement = { scenario: 'five_concurrent_shift_changes', employees: 100, scans: 1000, total_ms: Math.round(performance.now() - started), request_ms: timings }
    if (process.env.NEON_TEST_RESULTS_DIR) writeFileSync(path.join(process.env.NEON_TEST_RESULTS_DIR, 'scale-measurement.json'), JSON.stringify(measurement, null, 2))
    expect(await db.employee_shifts.count({ where: { employee_id: { in: employees.map((e: any) => e.id) }, work_date: new Date('2026-10-20T00:00:00Z') } })).toBe(5)
  })

  it('measures locking a day with 100 scheduled employees', async () => {
    const date = new Date('2026-10-20T00:00:00Z')
    const existing = await db.employee_shifts.findMany({ where: { employee_id: { in: loadEmployees.map(e => e.id) }, work_date: date } })
    const assigned = new Set(existing.map((s: any) => s.employee_id))
    const template = existing[0]
    await db.employee_shifts.createMany({ data: loadEmployees.filter(e => !assigned.has(e.id)).map(e => ({
      employee_id: e.id, work_date: date, shift_id: template.shift_id, shift_type: template.shift_type,
      start_time: template.start_time, end_time: template.end_time,
    })) })
    const started = performance.now()
    await attendance.toggleLock('2026-10-20', true, admin.id, 'ADMIN')
    const elapsed = Math.round(performance.now() - started)
    if (process.env.NEON_TEST_RESULTS_DIR) {
      const file = path.join(process.env.NEON_TEST_RESULTS_DIR, 'scale-measurement.json')
      const previous = JSON.parse(readFileSync(file, 'utf8'))
      writeFileSync(file, JSON.stringify({ ...previous, lock_100_employees_ms: elapsed }, null, 2))
    }
    expect((await db.attendance_locks.findUnique({ where: { work_date: date } })).is_locked).toBe(true)
  })
})
