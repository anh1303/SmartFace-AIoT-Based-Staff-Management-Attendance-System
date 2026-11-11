import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTodayVNString } from '../../src/common/utils.js'

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
  work_shifts: { findFirst: vi.fn(async () => ({ id: 1 })) },
  employee_shifts: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })),
    update: vi.fn(async ({ data }: any) => ({ id: 1n, ...data })),
  },
  daily_attendance_summary: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

const mockFindEmployee = vi.hoisted(() =>
  vi.fn(async (id: string, tx?: any) => {
    return { id: 'employee1', status: 'ACTIVE', employee_code: 'NV01' }
  })
)

vi.mock('../../src/modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: mockFindEmployee,
  findEmployeeByUserId: vi.fn(),
  assertCanManageEmployee: vi.fn(),
}))

vi.mock('../../src/modules/attendance/public.js', () => ({
  assertEditableDay: vi.fn(),
  aggregateDailyAttendance: vi.fn(),
  isAttendanceDateLocked: vi.fn(async () => false),
  invalidateDailySummaryForShiftChange: vi.fn(),
}))

import { assignOrUpdate } from '../../src/modules/shifts/shift.service.js'
import { configureShiftAttendance } from '../../src/modules/shifts/shift.attendance-port.js'
import * as attendance from '../../src/modules/attendance/public.js'

describe('Shift Past Date Lock Policy', () => {
  beforeEach(() => {
    configureShiftAttendance(attendance)
    vi.clearAllMocks()
    db.$transaction.mockImplementation((fn: any) => fn(db))
  })

  it('rejects shift assignment for past dates with 409 Conflict for Manager', async () => {
    const pastDate = '2026-10-05' // Strictly before today
    await expect(
      assignOrUpdate(
        { employee_id: 'employee1', date: pastDate, shift_type: 'OFFICE_HOURS' },
        'mgr-user-id',
        'MANAGER'
      )
    ).rejects.toThrow(/quá khứ/i)

    expect(db.employee_shifts.create).not.toHaveBeenCalled()
  })

  it('rejects shift assignment for past dates even for ADMIN', async () => {
    const pastDate = '2026-10-05'
    await expect(
      assignOrUpdate(
        { employee_id: 'employee1', date: pastDate, shift_type: 'OFF' },
        'admin-user-id',
        'ADMIN'
      )
    ).rejects.toThrow(/quá khứ/i)

    expect(db.employee_shifts.create).not.toHaveBeenCalled()
  })

  it('allows shift assignment for today or future dates', async () => {
    const today = getTodayVNString()
    const result = await assignOrUpdate(
      { employee_id: 'employee1', date: today, shift_type: 'OFFICE_HOURS' },
      'mgr-user-id',
      'MANAGER'
    )
    expect(result).toBeDefined()
    expect(result.date).toBe(today)
    expect(db.employee_shifts.create).toHaveBeenCalled()
  })
})
