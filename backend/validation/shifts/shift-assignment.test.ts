import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(), $transaction: vi.fn(),
  work_shifts: { findFirst: vi.fn(async () => ({ id: 1 })) },
  employee_shifts: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })) },
  daily_attendance_summary: { updateMany: vi.fn() }, auditLog: { create: vi.fn() },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
const mockFindEmployee = vi.hoisted(() => vi.fn(async (id: string, tx?: any) => {
  if (tx?.employee?.findUnique) return tx.employee.findUnique({ where: { id } })
  if (tx?.employee?.findFirst) return tx.employee.findFirst({ where: { id } })
  return { id: 'employee1', status: 'ACTIVE', employee_code: 'NV01' }
}))
vi.mock('../../src/modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: mockFindEmployee,
  findEmployeeByUserId: vi.fn(),
  assertCanManageEmployee: vi.fn(),
}))
vi.mock('../../src/modules/employees/index.js', () => ({
  findEmployeeByIdOrCode: mockFindEmployee,
  findEmployeeByUserId: vi.fn(),
  assertCanManageEmployee: vi.fn(),
}))
vi.mock('../../src/modules/attendance/public.js', () => ({ assertEditableDay: vi.fn(), aggregateDailyAttendance: vi.fn(), isAttendanceDateLocked: vi.fn(async () => false), invalidateDailySummaryForShiftChange: vi.fn() }))
vi.mock('../../src/modules/attendance/index.js', () => ({ assertEditableDay: vi.fn(), aggregateDailyAttendance: vi.fn(), isAttendanceDateLocked: vi.fn(async () => false), invalidateDailySummaryForShiftChange: vi.fn() }))
import { assignOrUpdate } from '../../src/modules/shifts/shift.service.js'
import { configureShiftAttendance } from '../../src/modules/shifts/shift.attendance-port.js'
import * as attendance from '../../src/modules/attendance/public.js'
import { shiftTemplateSchema } from '../../src/modules/shifts/template.dto.js'

beforeEach(() => {
  configureShiftAttendance(attendance)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T08:00:00+07:00'))
  vi.clearAllMocks()
  db.$transaction.mockImplementation(fn => fn(db))
})
afterEach(() => vi.useRealTimers())
describe('overnight shifts', () => {
  it('assigns an overnight shift on its starting work date', async () => {
    const assigned = await assignOrUpdate({ employee_id: 'employee1', date: '2026-11-10', shift_type: 'OTHER', start_time: '22:00', end_time: '06:00' }, 'admin', 'ADMIN')
    expect(assigned).toMatchObject({ date: '2026-11-10', start_time: '22:00', end_time: '06:00', shift_type: 'OTHER' })
    expect(attendance.assertEditableDay).toHaveBeenCalledWith(db, '2026-11-10', 'employee1')
    expect(attendance.invalidateDailySummaryForShiftChange).toHaveBeenCalledWith('employee1', expect.any(Date), db)
    expect(attendance.aggregateDailyAttendance).toHaveBeenCalledWith(11, 2026, 'employee1', '2026-11-10', undefined, db)
  })
  it('accepts overnight reusable templates', () => {
    expect(shiftTemplateSchema.safeParse({ name: 'Ca đêm', start_time: '22:00', end_time: '06:00' }).success).toBe(true)
  })
  it.each([['08:00', '08:00'], ['24:00', '06:00'], ['22:00', '06:60'], ['', '06:00']])('rejects invalid or zero-duration OTHER %s–%s before creating a shift', async (start_time, end_time) => {
    await expect(assignOrUpdate({ employee_id: 'employee1', date: '2026-11-10', shift_type: 'OTHER', start_time, end_time }, 'admin', 'ADMIN')).rejects.toThrow()
    expect(db.employee_shifts.create).not.toHaveBeenCalled()
  })
  it('locks payroll period before employee lock and rejects terminated employee', async () => {
    const executedLocks: string[] = []
    db.$executeRaw.mockImplementation((queryParts: any, ...values: any[]) => {
      executedLocks.push(values[0])
      return Promise.resolve(1)
    })
    db.employee = {
      findUnique: vi.fn(async () => ({ status: 'TERMINATED' }))
    }

    await expect(
      assignOrUpdate({ employee_id: 'employee1', date: '2026-11-05', shift_type: 'OFFICE_HOURS' }, 'admin', 'ADMIN')
    ).rejects.toThrow('TERMINATED')

    // Period lock (payroll:2026-11) MUST precede employee lock (employee:employee1)
    expect(executedLocks[0]).toBe('payroll:2026-11')
    expect(executedLocks[1]).toBe('employee:employee1')
    expect(db.employee_shifts.create).not.toHaveBeenCalled()
  })
})
