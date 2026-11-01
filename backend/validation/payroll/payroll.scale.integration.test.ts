import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { randomUUID } from 'node:crypto'
import { describe, it, expect, vi } from 'vitest'
import { ensureTestPayrollPolicy } from './policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
;(enabled ? describe : describe.skip)('payroll at expected scale', () => {
  it('generates monthly payroll for 100 employees', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-02T12:00:00+07:00'))
    const db = (await import('../../src/config/database.js')).prisma
    try {
      await ensureTestPayrollPolicy(db)
      const payroll = await import('../../src/modules/payroll/payroll.service.js')
      const prefix = randomUUID().slice(0,8)
      const role = await db.roles.findUniqueOrThrow({ where: { role_name: 'ADMIN' } })
      const admin = await db.user.create({ data: { username: `PAY-${prefix}`, passwordHash: 'test-only', role_id: role.id } })
      await db.employee.createMany({ data: Array.from({ length: 100 }, (_, i) => ({ employee_code: `PAY-${prefix}-${i}`, full_name: `Payroll ${i}`, hourly_rate: 100000, createdAt: new Date('2026-10-01T00:00:00Z') })) })
      const result = await payroll.generate('2026-10', undefined, admin.id, { id: admin.id, role: 'ADMIN' })
      expect(result).toHaveLength(100)
      expect(await db.payrollRecord.count({ where: { payroll_period: '2026-10' } })).toBe(100)
    } finally { vi.useRealTimers(); await db.$disconnect() }
  })
})
