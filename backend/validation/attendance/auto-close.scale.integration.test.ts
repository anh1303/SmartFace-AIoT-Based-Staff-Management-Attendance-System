import { randomUUID } from 'node:crypto'
import { describe, it, expect, vi } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
;(enabled ? describe : describe.skip)('auto close at expected scale', () => {
  it('closes 100 eligible employees without a transaction timeout', async () => {
    await import('../../src/composition.js')
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T01:00:00+07:00'))
    const db = (await import('../../src/config/database.js')).prisma
    try {
      await ensureTestPayrollPolicy(db)
      const service = await import('../../src/modules/attendance/attendance.service.js')
      const prefix = randomUUID().slice(0,8)
      await db.employee.createMany({ data: Array.from({ length: 100 }, (_, i) => ({ employee_code: `CLOSE-${prefix}-${i}`, full_name: `Close ${i}`, hourly_rate: 100000 })) })
      const employees = await db.employee.findMany({ where: { employee_code: { startsWith: `CLOSE-${prefix}-` } } })
      const date = new Date('2026-10-02T00:00:00Z')
      await db.daily_attendance_summary.createMany({ data: employees.map((employee, index) => ({
        employee_id: employee.id, work_date: date, attendance_status: index < 50 ? 'INCOMPLETE' : 'PRESENT',
        review_status: index < 50 ? 'PENDING' : 'NONE', requires_review: index < 50, policy_version: 'test',
        first_check_in: new Date('2026-10-02T08:00:00+07:00'), last_check_out: index < 50 ? null : new Date('2026-10-02T17:00:00+07:00'),
        calculation_details: { scheduledEnd: '2026-10-02T17:00:00+07:00', scheduledShiftSeconds: 32400, fingerprint: 'test', policy: 'test', isMissingOrIncomplete: index < 50 },
      })) })
      await service.autoCloseDueAttendance(new Date('2026-10-03T01:00:00+07:00'))
      expect(await db.daily_attendance_summary.count({ where: { employee_id: { in: employees.map(e => e.id) }, review_status: 'APPROVED' } })).toBe(100)
      const penalties = await db.attendanceAdjustment.findMany({ where: { employee_id: { in: employees.map(e => e.id) }, kind: 'LATE_EARLY' } })
      expect(penalties).toHaveLength(50)
      expect(penalties.every(item => item.status === 'APPROVED' && Number(item.hours) === 9)).toBe(true)
    } finally { vi.useRealTimers(); await db.$disconnect() }
  })
})
