import { expect, it, vi } from 'vitest'
import { writePayrollBatch, type PayrollBatchRow } from '../../src/modules/payroll/payroll.batch.js'

it('writes parameterized batches, reads the scoped result once, and protects closed rows', async () => {
  const rows = Array.from({ length: 251 }, (_, i) => ({ employeeId: `employee-${i}`, payroll_period: '2026-11', status: 'PENDING', hourly_rate: 90000, total_working_hours: 8, total_overtime: 1, total_late_early: 0, total_absence_penalty: 0, allowance: 1500000, net_salary: 2400000, overtime_rate: 2, late_penalty_rate: 1.5, calculation_details: { reason: "quote ' must stay data" } })) as PayrollBatchRow[]
  const db = { $executeRaw: vi.fn(async () => 1), payrollRecord: { findMany: vi.fn(async () => rows) } }
  expect(await writePayrollBatch(db as any, rows)).toEqual(rows)
  expect(db.$executeRaw).toHaveBeenCalledTimes(2)
  const statement = db.$executeRaw.mock.calls[0][0] as any
  expect(statement.sql).toContain('ON CONFLICT')
  expect(statement.sql).toContain("payroll_records.status = 'PENDING'")
  expect(statement.sql).not.toContain("quote ' must stay data")
  expect(JSON.parse(statement.values[0])).toHaveLength(250)
  expect(db.payrollRecord.findMany).toHaveBeenCalledOnce()
  expect(db.payrollRecord.findMany).toHaveBeenCalledWith({ where: { OR: rows.map(row => ({ employeeId: row.employeeId, payroll_period: row.payroll_period })) } })
})

it('does not query or write for an empty authorized scope', async () => {
  const db = { $executeRaw: vi.fn(), payrollRecord: { findMany: vi.fn() } }
  expect(await writePayrollBatch(db as any, [])).toEqual([])
  expect(db.$executeRaw).not.toHaveBeenCalled()
  expect(db.payrollRecord.findMany).not.toHaveBeenCalled()
})
