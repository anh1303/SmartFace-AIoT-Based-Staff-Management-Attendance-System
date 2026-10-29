import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(), $transaction: vi.fn(),
  work_shifts: { findFirst: vi.fn(async () => ({ id: 1 })) },
  employee_shifts: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })) },
  daily_attendance_summary: { updateMany: vi.fn() }, auditLog: { create: vi.fn() },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/employees/index.js', () => ({ findEmployeeByIdOrCode: vi.fn(async () => ({ id: 'employee1', status: 'ACTIVE', employee_code: 'NV01' })), findEmployeeByUserId: vi.fn() }))
vi.mock('../../src/modules/attendance/index.js', () => ({ assertEditableDay: vi.fn(), aggregateDailyAttendance: vi.fn(), isAttendanceDateLocked: vi.fn(async () => false) }))
import { assignOrUpdate } from '../../src/modules/shifts/shift.service.js'
import { shiftTemplateSchema } from '../../src/modules/shifts/template.dto.js'

beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation(fn => fn(db)) })
describe('overnight shifts', () => {
  it('assigns an overnight shift on its starting work date', async () => {
    const assigned = await assignOrUpdate({ employee_id: 'employee1', date: '2026-10-31', shift_type: 'OTHER', start_time: '22:00', end_time: '06:00' }, 'admin', 'ADMIN')
    expect(assigned).toMatchObject({ date: '2026-10-31', start_time: '22:00', end_time: '06:00', shift_type: 'OTHER' })
  })
  it('accepts overnight reusable templates', () => {
    expect(shiftTemplateSchema.safeParse({ name: 'Ca đêm', start_time: '22:00', end_time: '06:00' }).success).toBe(true)
  })
  it.each([['08:00', '08:00'], ['24:00', '06:00'], ['22:00', '06:60'], ['', '06:00']])('rejects invalid or zero-duration OTHER %s–%s before creating a shift', async (start_time, end_time) => {
    await expect(assignOrUpdate({ employee_id: 'employee1', date: '2026-10-31', shift_type: 'OTHER', start_time, end_time }, 'admin', 'ADMIN')).rejects.toThrow()
    expect(db.employee_shifts.create).not.toHaveBeenCalled()
  })
})
