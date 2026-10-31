import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { adjustmentFingerprint } from '../../src/modules/attendance/attendance.adjustments.js'

const state = vi.hoisted(() => ({ record: null as any, summaries: [] as any[], employee: null as any }))
vi.mock('../../src/modules/attendance/index.js', () => ({ aggregateDailyAttendance: vi.fn(async () => ({})), getAttendanceSummariesByEmployeesAndDateRange: vi.fn() }))
vi.mock('../../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    attendanceAggregationState: { findUnique: vi.fn(async () => null) },
    employee: { findMany: vi.fn(async () => [state.employee]), findFirst: vi.fn(async () => state.employee) },
    bonusPenalty: { findFirst: vi.fn(async () => ({ id: 1, overtime_rate: 2.0, late_early_penalty: 1.5, absence_penalty_rate: 2.0 })) },
    daily_attendance_summary: { findMany: vi.fn(async () => state.summaries), count: vi.fn(async () => 0) },
    attendanceAdjustment: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    attendance_locks: { findMany: vi.fn(async () => []) },
    auditLog: { create: vi.fn(async () => ({})) },
    payrollRecord: {
      findUnique: vi.fn(async () => state.record), findUniqueOrThrow: vi.fn(async () => state.record),
      findMany: vi.fn(async () => [state.record]),
      upsert: vi.fn(async ({ update }: any) => { state.record = { ...state.record, ...update, updated_at: new Date(+state.record.updated_at + 1) }; return state.record }),
      update: vi.fn(async ({ data }: any) => { state.record = { ...state.record, ...data, updated_at: new Date(+state.record.updated_at + 1) }; return state.record }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  }
  db.$transaction = async (work: any) => work(db)
  return { prisma: db }
})

import { generate, updateItem, finalizePeriod, list, formatPayrollRecord } from '../../src/modules/payroll/payroll.service.js'
const actor = { id: 'admin-user', role: 'ADMIN' }
const calculate = () => generate('2026-10', state.employee.id, actor.id, actor)

describe('Unresolved legacy snapshots', () => {
  it('keeps paid money but does not reinterpret the old fixed rate as a multiplier', () => {
    state.record.status = 'PAID'
    state.record.overtime_rate = 100000
    state.record.total_overtime = 2
    state.record.calculation_details = { rate_snapshot_status: 'UNRESOLVED' }
    expect(formatPayrollRecord(state.record)).toMatchObject({ net_salary: 10500000, overtime_rate: null, breakdown: null, requires_reconciliation: true })
  })
  it('blocks editing and regenerating an unresolved record before any writes', async () => {
    state.record.calculation_details = { rate_snapshot_status: 'UNRESOLVED' }
    await expect(updateItem('1', { allowance: 0, reason: 'Test' }, actor)).rejects.toThrow(/đối soát/)
    await expect(calculate()).rejects.toThrow(/đối soát/)
  })
  it('rejects finalization of unresolved history before refreshing attendance', async () => {
    state.record.calculation_details = { rate_snapshot_status: 'UNRESOLVED' }
    await expect(finalizePeriod('2026-10', actor.id, actor.role)).rejects.toThrow(/đối soát/)
  })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T20:00:00+07:00'))
  state.employee = { id: '00000000-0000-4000-8000-000000000001', employee_code: 'NV-001', full_name: 'Test employee', hourly_rate: 100000, status: 'ACTIVE', departmentId: 1, user_id: 'employee-user', department: { name: 'A' }, position: { level: 'EMPLOYEE' }, users: { roles: { role_name: 'EMPLOYEE' } } }
  state.summaries = [{ id: 1n, employee_id: state.employee.id, work_date: new Date('2026-10-29T00:00:00Z'), total_working_hours: 90, overtime: 0, late_early: 0, overtime_status: 'NONE', policy_version: '2026-10-29-v6', requires_review: false, calculation_details: { fingerprint: 'source-90', scheduledEnd: '2026-10-29T17:00:00+07:00' } }]
  state.record = { id: 1n, employeeId: state.employee.id, employee: state.employee, payroll_period: '2026-10', hourly_rate: 100000, total_working_hours: 90, total_overtime: 0, total_late_early: 0, total_absence_penalty: 0, allowance: 1500000, net_salary: 10500000, overtime_rate: 2.0, late_penalty_rate: 1.5, status: 'PENDING', updated_at: new Date(), calculation_details: { adjustment_fingerprint: adjustmentFingerprint([]) } }
})
afterEach(() => vi.useRealTimers())

describe('Independent payroll edits and source reconciliation', () => {
  it('does not reprice an earlier month from a later profile rate change', async () => {
    state.record.payroll_period = '2026-09'
    state.summaries[0].work_date = new Date('2026-09-29T00:00:00Z')
    state.employee.hourly_rate = 120000
    const [result] = await generate('2026-09', state.employee.id, actor.id, actor)
    expect(result.hourly_rate).toBe(100000)
    expect(result.net_salary).toBe(10500000)
    expect((await list('2026-09', undefined, actor))[0].needs_recalculation).toBe(false)
  })

  it('uses the recorded month rate when calculating an old month that was never generated', async () => {
    state.employee.hourly_rate = 130000
    state.employee.hourly_rate_history = [{ period: '2000-01', rate: 90000 }, { period: '2026-10', rate: 120000 }, { period: '2026-11', rate: 130000 }]
    vi.setSystemTime(new Date('2026-11-10T10:00:00+07:00'))
    const [result] = await calculate()
    expect(result.hourly_rate).toBe(120000)
    expect(result.net_salary).toBe(12300000)
  })
  it('updates 90 to 180 source hours after an allowance-only edit, preserving the allowance', async () => {
    await calculate()
    await updateItem('1', { allowance: 2000000, reason: 'Phụ cấp thêm' }, actor)
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    const [result] = await calculate()
    expect(result.total_working_hours).toBe(180)
    expect(result.allowance).toBe(2000000)
    expect(result.net_salary).toBe(20000000)
  })

  it('does not freeze profile hourly rate after an allowance-only edit', async () => {
    await calculate()
    await updateItem('1', { allowance: 0, reason: 'Không phụ cấp' }, actor)
    state.employee.hourly_rate = 120000
    const [result] = await calculate()
    expect(result.hourly_rate).toBe(120000)
    expect(result.allowance).toBe(0)
  })







  it('rejects editing payroll hours or hourly rate', async () => {
    await calculate()
    await expect(updateItem('1', { total_working_hours: 95, reason: 'Edit' }, actor)).rejects.toMatchObject({ statusCode: 400 })
    await expect(updateItem('1', { hourly_rate: 200000, reason: 'Edit' }, actor)).rejects.toMatchObject({ statusCode: 400 })
    expect(state.record.total_working_hours).toBe(90)
  })

  it('regenerates pending overrides from attendance and employee rate, preserving allowance', async () => {
    state.record.total_working_hours = 150
    state.record.hourly_rate = 200000
    state.record.allowance = 2500000
    state.record.calculation_details = { field_overrides: { working_hours: { value: 150, reason: 'old', basis_fingerprint: null }, hourly_rate: { value: 200000, reason: 'old' } }, adjustment_fingerprint: adjustmentFingerprint([]) }
    const [result] = await calculate()
    expect(result).toMatchObject({ total_working_hours: 90, hourly_rate: 100000, allowance: 2500000, requires_reconciliation: false })
    expect(state.record.calculation_details.field_overrides).toEqual({})
  })
  it('restores a historical profile rate from wage history, not the payroll override', async () => {
    state.record.payroll_period = '2026-09'
    state.record.hourly_rate = 200000
    state.record.calculation_details = { field_overrides: { hourly_rate: { value: 200000, reason: 'old' } } }
    state.employee.hourly_rate = 120000
    state.employee.hourly_rate_history = [{ period: '0000-01', rate: 80000 }, { period: '2026-10', rate: 120000 }]
    const [result] = await generate('2026-09', state.employee.id, actor.id, actor)
    expect(result.hourly_rate).toBe(80000)
    expect(result.allowance).toBe(1500000)
  })
  it('does not guess an old manually overridden rate without wage history', async () => {
    state.record.payroll_period = '2026-09'
    state.record.calculation_details = { manual: true, reason: 'old' }
    await expect(generate('2026-09', state.employee.id, actor.id, actor)).rejects.toMatchObject({ statusCode: 409 })
    expect(state.record.calculation_details.manual).toBe(true)
  })

  it('returns stale status from current attendance without rewriting the saved payroll', async () => {
    await calculate()
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    expect((await list('2026-10', undefined, actor))[0]).toMatchObject({ total_working_hours: 90, needs_recalculation: true })
    expect(state.record.total_working_hours).toBe(90)
  })



  it('rejects a stale edit version and never edits finalized wages', async () => {
    await calculate()
    await expect(updateItem('1', { allowance: 0, reason: 'Đổi', updated_at: '2020-01-01T00:00:00.000Z' }, actor)).rejects.toMatchObject({ statusCode: 409 })
    state.record.status = 'FINALIZED'
    await expect(updateItem('1', { allowance: 0, reason: 'Đổi' }, actor)).rejects.toMatchObject({ statusCode: 409 })
    expect(state.record.allowance).toBe(1500000)
  })

  it('blocks finalizing a non-overridden hourly rate that changed in the employee profile', async () => {
    await calculate()
    state.employee.hourly_rate = 120000
    await expect(finalizePeriod('2026-10', actor.id, actor.role)).rejects.toThrow(/lương giờ/)
  })

  it('blocks finalizing a payroll with missing rate snapshot units even when attendance matches', async () => {
    await calculate()
    state.record.overtime_rate = null
    await expect(finalizePeriod('2026-10', actor.id, actor.role)).rejects.toThrow(/snapshot hệ số lương|đơn giá/)
  })
})
