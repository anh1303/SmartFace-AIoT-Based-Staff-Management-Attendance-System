import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip
suite('Payroll policy storage on PostgreSQL', () => {
  let db: any, payroll: any
  beforeAll(async () => { db = (await import('../../src/config/database.js')).prisma; payroll = await import('../../src/modules/payroll/payroll.service.js') })
  afterAll(async () => { if (db) await db.$disconnect() })
  it.each([0, 2, 9.9999, 10, 50])('round-trips all three multipliers exactly: %s', async value => {
    const month = [0, 2, 9.9999, 10, 50].indexOf(value) + 1
    const saved = await payroll.updateBonusPenalty({ effective_period: `2080-${String(month).padStart(2, '0')}`, overtime_rate: value, late_early_penalty: value, absence_penalty_rate: value })
    const reread = await db.bonusPenalty.findUnique({ where: { id: saved.id } })
    for (const key of ['overtime_rate', 'late_early_penalty', 'absence_penalty_rate']) expect(Number(reread[key])).toBe(value)
  })
  it('rejects overwriting a policy through both the API and a direct DB write', async () => {
    await expect(payroll.updateBonusPenalty({ effective_period: '2080-01', overtime_rate: 3 })).rejects.toThrow(/phiên bản/)
    await expect(db.bonusPenalty.update({ where: { effective_period: '2080-01' }, data: { overtime_rate: 3 } })).rejects.toThrow(/immutable/)
  })
  it('returns the policy effective in the requested period and never a later version', async () => {
    expect(await payroll.getBonusPenalty('2080-02')).toMatchObject({ effective_period: '2080-02', overtime_rate: 2 })
    expect(await payroll.getBonusPenalty('2080-03')).toMatchObject({ effective_period: '2080-03', overtime_rate: 9.9999 })
    expect(await payroll.getBonusPenalty('2000-01')).toBeNull()
  })
  it('rejects an API input that would silently lose decimal precision', async () => {
    await expect(payroll.updateBonusPenalty({ effective_period: '2081-01', absence_penalty_rate: 1.23456 })).rejects.toThrow()
    expect(await db.bonusPenalty.findUnique({ where: { effective_period: '2081-01' } })).toBeNull()
  })
  it('rejects raw DB multipliers outside the supported range', async () => {
    await expect(db.bonusPenalty.create({ data: { effective_period: '2082-01', absence_penalty_rate: 51 } })).rejects.toThrow()
  })
  it('keeps zero-valued snapshots on a finalized payroll', async () => {
    const employee = await db.employee.create({ data: { employee_code: `RATE-${randomUUID()}`, full_name: 'Zero multiplier', hourly_rate: 100000 } })
    const row = await db.payrollRecord.create({ data: { employeeId: employee.id, payroll_period: '2079-01', hourly_rate: 100000, total_working_hours: 8, net_salary: 800000, overtime_rate: 0, late_penalty_rate: 0, status: 'PAID', calculation_details: { rate_snapshot_status: 'MULTIPLIER' } } })
    expect(payroll.formatPayrollRecord(row)).toMatchObject({ overtime_rate: 0, late_penalty_rate: 0, net_salary: 800000, breakdown: { overtime_pay: 0, late_early_deduction: 0 } })
  })
  it('reconciles verified history with a read-only preview and preserves settled money', async () => {
    const employee = await db.employee.create({ data: { employee_code: `REPAIR-${randomUUID()}`, full_name: 'Synthetic repair', hourly_rate: 100000 } })
    const row = await db.payrollRecord.create({ data: { employeeId: employee.id, payroll_period: '2079-02', hourly_rate: 100000, total_working_hours: 8,
      total_overtime: 2, total_late_early: 1, net_salary: 950000, overtime_rate: 100000, late_penalty_rate: 50000, status: 'PAID', calculation_details: { rate_snapshot_status: 'UNRESOLVED' } } })
    const directory = await mkdtemp(path.join(tmpdir(), 'payroll-repair-test-'))
    try {
      const file = path.join(directory, 'verified.json')
      await writeFile(file, JSON.stringify({ source_reference: 'synthetic-test-backup', records: [{ id: String(row.id), expected_updated_at: row.updated_at.toISOString(), expected_net_salary: 950000,
        overtime: { value: 100000, unit: 'FIXED_PER_HOUR' }, late: { value: 50000, unit: 'FIXED_PER_HOUR' } }] }))
      const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/payroll-rate-repair.ts', file, ...args], { encoding: 'utf8', env: process.env }))
      expect(run().mode).toBe('read-only')
      expect((await db.payrollRecord.findUnique({ where: { id: row.id } })).calculation_details.rate_snapshot_status).toBe('UNRESOLVED')
      expect(run('--apply').mode).toBe('applied')
      const saved = await db.payrollRecord.findUnique({ where: { id: row.id } })
      expect(Number(saved.net_salary)).toBe(950000)
      expect(Number(saved.overtime_rate)).toBe(100000)
      expect(payroll.formatPayrollRecord(saved).breakdown).toMatchObject({ overtime_pay: 200000, late_early_deduction: 50000, net_salary: 950000 })
      expect(await db.auditLog.count({ where: { action: 'VERIFY_LEGACY_PAYROLL_RATES', record_id: String(row.id) } })).toBe(1)
    } finally { await rm(directory, { recursive: true, force: true }) }
  }, 15000)
  it('prepares only reviewed pending multipliers and forces an explicit regeneration', async () => {
    const employee = await db.employee.create({ data: { employee_code: `PENDING-${randomUUID()}`, full_name: 'Synthetic pending repair', hourly_rate: 100000 } })
    const row = await db.payrollRecord.create({ data: { employeeId: employee.id, payroll_period: '2079-03', hourly_rate: 100000, total_working_hours: 8, total_overtime: 2, total_late_early: 1, net_salary: 950000,
      overtime_rate: 100000, late_penalty_rate: 50000, calculation_details: { rate_snapshot_status: 'UNRESOLVED', source_fingerprint: 'old', adjustment_fingerprint: 'old' } } })
    const directory = await mkdtemp(path.join(tmpdir(), 'payroll-repair-test-'))
    try {
      const file = path.join(directory, 'pending.json')
      await writeFile(file, JSON.stringify({ source_reference: 'synthetic-old-policy', records: [{ id: String(row.id), expected_updated_at: row.updated_at.toISOString(), expected_net_salary: 950000,
        overtime: { value: 100000, unit: 'FIXED_PER_HOUR' }, late: { value: 50000, unit: 'FIXED_PER_HOUR' } }] }))
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/payroll-rate-repair.ts', file, '--apply'], { env: process.env })
      const intermediate = await db.payrollRecord.findUnique({ where: { id: row.id } })
      expect(intermediate.calculation_details.rate_snapshot_status).toBe('LEGACY_VERIFIED')
      await writeFile(file, JSON.stringify({ source_reference: 'approved-new-multiplier-policy', records: [{ id: String(row.id), expected_updated_at: intermediate.updated_at.toISOString(), expected_net_salary: 950000,
        prepare_pending_recalculation: true, overtime: { value: 2, unit: 'HOURLY_MULTIPLIER' }, late: { value: 1.5, unit: 'HOURLY_MULTIPLIER' } }] }))
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/payroll-rate-repair.ts', file, '--apply'], { env: process.env })
      const saved = await db.payrollRecord.findUnique({ where: { id: row.id } })
      expect(Number(saved.net_salary)).toBe(950000)
      expect(Number(saved.overtime_rate)).toBe(2)
      expect(saved.calculation_details).toMatchObject({ rate_snapshot_status: 'MULTIPLIER', needs_recalculation: true, source_fingerprint: null, adjustment_fingerprint: null })
    } finally { await rm(directory, { recursive: true, force: true }) }
  }, 15000)
})
