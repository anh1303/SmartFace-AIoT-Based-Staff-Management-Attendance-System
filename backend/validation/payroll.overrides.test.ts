import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { adjustmentFingerprint } from '../src/modules/attendance/attendance.adjustments.js'

const state = vi.hoisted(() => ({ record: null as any, summaries: [] as any[], employee: null as any }))
vi.mock('../src/modules/attendance/index.js', () => ({ aggregateDailyAttendance: vi.fn(async () => ({})), getAttendanceSummariesByEmployeesAndDateRange: vi.fn() }))
vi.mock('../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    employee: { findMany: vi.fn(async () => [state.employee]), findFirst: vi.fn(async () => state.employee) },
    bonusPenalty: { findFirst: vi.fn(async () => ({ id: 1, overtime_rate: 100000, late_early_penalty: 50000, absence_penalty_rate: .25, overtime_rate_kind: 'FIXED_PER_HOUR', late_early_penalty_kind: 'FIXED_PER_HOUR' })) },
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

import { generate, updateItem, finalizePeriod, list } from '../src/modules/payroll/payroll.service.js'
const actor = { id: 'admin-user', role: 'ADMIN' }
const calculate = () => generate('2026-10', state.employee.id, actor.id, actor)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T20:00:00+07:00'))
  state.employee = { id: '00000000-0000-4000-8000-000000000001', employee_code: 'NV-001', full_name: 'Test employee', hourly_rate: 100000, status: 'ACTIVE', departmentId: 1, user_id: 'employee-user', department: { name: 'A' }, position: { level: 'EMPLOYEE' }, users: { roles: { role_name: 'EMPLOYEE' } } }
  state.summaries = [{ id: 1n, employee_id: state.employee.id, work_date: new Date('2026-10-29T00:00:00Z'), total_working_hours: 90, overtime: 0, late_early: 0, overtime_status: 'NONE', policy_version: '2026-10-29-v6', requires_review: false, calculation_details: { fingerprint: 'source-90', scheduledEnd: '2026-10-29T17:00:00+07:00' } }]
  state.record = { id: 1n, employeeId: state.employee.id, employee: state.employee, payroll_period: '2026-10', hourly_rate: 100000, total_working_hours: 90, total_overtime: 0, total_late_early: 0, total_absence_penalty: 0, allowance: 1500000, net_salary: 10500000, overtime_rate: 100000, late_penalty_rate: 50000, overtime_rate_kind: 'FIXED_PER_HOUR', late_penalty_rate_kind: 'FIXED_PER_HOUR', status: 'PENDING', updated_at: new Date(), calculation_details: { adjustment_fingerprint: adjustmentFingerprint([]) } }
})
afterEach(() => vi.useRealTimers())

describe('Independent payroll edits and source reconciliation', () => {
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

  it('keeps explicitly overridden hours but repeatedly blocks finalization after their source changes', async () => {
    await calculate()
    await updateItem('1', { total_working_hours: 95, reason: 'Bù công đã xác minh' }, actor)
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    expect((await calculate())[0]).toMatchObject({ total_working_hours: 95, requires_reconciliation: true })
    expect((await calculate())[0]).toMatchObject({ requires_reconciliation: true })
    await expect(finalizePeriod('2026-10', actor.id, actor.role)).rejects.toThrow(/đối chiếu/)
    await updateItem('1', { allowance: 0, reason: 'Đổi phụ cấp' }, actor)
    expect((await calculate())[0]).toMatchObject({ requires_reconciliation: true })
  })

  it('allows explicitly resetting manual hours to the current backend source', async () => {
    await calculate()
    await updateItem('1', { total_working_hours: 95, reason: 'Bù công' }, actor)
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    await calculate()
    const result = await updateItem('1', { reset_working_hours: true, reason: 'Dùng công nguồn mới' } as any, actor)
    expect(result).toMatchObject({ total_working_hours: 180, requires_reconciliation: false })
    expect((await calculate())[0].total_working_hours).toBe(180)
  })

  it('does not treat unchanged fields in the old frontend full-form payload as overrides', async () => {
    await calculate()
    await updateItem('1', { allowance: 0, hourly_rate: 100000, total_working_hours: 90, total_overtime: 0, total_late_early: 0, reason: 'Chỉ phụ cấp' }, actor)
    state.summaries[0].total_working_hours = 180
    const [result] = await calculate()
    expect(result.total_working_hours).toBe(180)
  })

  it('marks legacy blanket manual edits for reconciliation instead of silently acknowledging them', async () => {
    state.record.calculation_details = { manual: true, reason: 'Legacy', adjustment_fingerprint: adjustmentFingerprint([]) }
    expect((await calculate())[0]).toMatchObject({ total_working_hours: 90, requires_reconciliation: true })
    expect((await calculate())[0]).toMatchObject({ requires_reconciliation: true })
  })

  it('returns stale status from current attendance without rewriting the saved payroll', async () => {
    await calculate()
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    expect((await list('2026-10', undefined, actor))[0]).toMatchObject({ total_working_hours: 90, needs_recalculation: true })
    expect(state.record.total_working_hours).toBe(90)
  })

  it('allows keeping the same manual value only through explicit reconciliation with the new source', async () => {
    await calculate()
    await updateItem('1', { total_working_hours: 95, reason: 'Bù công' }, actor)
    state.summaries[0].total_working_hours = 180
    state.summaries[0].calculation_details.fingerprint = 'source-180'
    await calculate()
    const result = await updateItem('1', { reconcile_working_hours: true, total_working_hours: 95, reason: 'Đã đối chiếu giữ 95 giờ' }, actor)
    expect(result).toMatchObject({ total_working_hours: 95, requires_reconciliation: false })
    expect((await calculate())[0]).toMatchObject({ total_working_hours: 95, requires_reconciliation: false })
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
    state.record.overtime_rate_kind = null
    await expect(finalizePeriod('2026-10', actor.id, actor.role)).rejects.toThrow(/đơn giá/)
  })
})
