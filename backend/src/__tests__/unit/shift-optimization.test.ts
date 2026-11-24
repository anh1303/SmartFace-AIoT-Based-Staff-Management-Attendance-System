import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeScope: vi.fn(),
  findEmployeeByUserId: vi.fn(),
  findEmployeeByIdOrCode: vi.fn(),
  assertCanManageEmployee: vi.fn(),
  isAttendanceDateLocked: vi.fn(),
  assertEditableDay: vi.fn(),
  invalidateDailySummaryForShiftChange: vi.fn(),
  aggregateDailyAttendance: vi.fn(),
  shiftsFindMany: vi.fn(),
  txExecuteRaw: vi.fn(),
  txShiftsFindMany: vi.fn(),
  txShiftsFindFirst: vi.fn(),
  txShiftsCreate: vi.fn(),
  txShiftsUpdate: vi.fn(),
  txWorkShiftsFindFirst: vi.fn(),
  txAuditCreate: vi.fn(),
}))

vi.mock('../../config/database.js', () => ({
  prisma: {
    employee_shifts: {
      findMany: mocks.shiftsFindMany,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $executeRaw: mocks.txExecuteRaw,
        employee_shifts: {
          findMany: mocks.txShiftsFindMany,
          findFirst: mocks.txShiftsFindFirst,
          create: mocks.txShiftsCreate,
          update: mocks.txShiftsUpdate,
        },
        work_shifts: {
          findFirst: mocks.txWorkShiftsFindFirst,
        },
        auditLog: {
          create: mocks.txAuditCreate,
        },
      }),
    ),
  },
}))

vi.mock('../../modules/employees/public.js', () => ({
  getEmployeeScope: mocks.getEmployeeScope,
  findEmployeeByUserId: mocks.findEmployeeByUserId,
  findEmployeeByIdOrCode: mocks.findEmployeeByIdOrCode,
  assertCanManageEmployee: mocks.assertCanManageEmployee,
}))

vi.mock('../../modules/shifts/shift.attendance-port.js', () => ({
  shiftAttendance: () => ({
    isAttendanceDateLocked: mocks.isAttendanceDateLocked,
    assertEditableDay: mocks.assertEditableDay,
    invalidateDailySummaryForShiftChange: mocks.invalidateDailySummaryForShiftChange,
    aggregateDailyAttendance: mocks.aggregateDailyAttendance,
  }),
}))

import * as shiftService from '../../modules/shifts/shift.service.js'

describe('Task 5 - Shifts list date filter & batched advisory locks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeScope.mockResolvedValue({})
    mocks.isAttendanceDateLocked.mockResolvedValue(false)
    mocks.assertEditableDay.mockResolvedValue(undefined)
    mocks.invalidateDailySummaryForShiftChange.mockResolvedValue(undefined)
    mocks.aggregateDailyAttendance.mockResolvedValue(undefined)
    mocks.assertCanManageEmployee.mockResolvedValue(undefined)
    mocks.txExecuteRaw.mockResolvedValue(1)
    mocks.txAuditCreate.mockResolvedValue({ id: 'audit-1' })
  })

  it('list({ startDate, endDate }) filters work_date range and uses lightweight employee select', async () => {
    mocks.shiftsFindMany.mockResolvedValue([
      {
        id: 10n,
        version: 2,
        work_date: new Date('2026-11-25T00:00:00.000Z'),
        work_day: 'Thứ Tư',
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T17:00:00.000Z'),
        shift_type: 'OFFICE_HOURS',
        note: '',
        employee_id: 'emp-1',
        employees: { employee_code: 'EMP-001', department: { name: 'Engineering' } },
        work_shifts: null,
      },
    ])

    const rows = await shiftService.list(
      { startDate: '2026-11-23', endDate: '2026-11-29' },
      { id: 'admin-1', role: 'ADMIN' },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      shift_id: '10',
      employee_id: 'EMP-001',
      date: '2026-11-25',
      department: 'Engineering',
    })

    const callArg = mocks.shiftsFindMany.mock.calls[0][0]
    expect(callArg.where.work_date).toEqual({
      gte: new Date('2026-11-23T00:00:00.000Z'),
      lte: new Date('2026-11-29T00:00:00.000Z'),
    })
    expect(callArg.include.employees).toEqual({
      select: {
        employee_code: true,
        department: { select: { name: true } },
      },
    })
  })

  it('assignOrUpdate acquires advisory locks in one SQL call with strict order and queries nearby shifts once', async () => {
    const emp = { id: 'emp-uuid-1', employee_code: 'EMP-001', status: 'ACTIVE' }
    mocks.findEmployeeByIdOrCode.mockResolvedValue(emp)
    mocks.txShiftsFindMany.mockResolvedValue([])
    mocks.txWorkShiftsFindFirst.mockResolvedValue({ id: 1, shift_name: 'Ca Hành Chính' })
    mocks.txShiftsCreate.mockResolvedValue({
      id: 99n,
      version: 1,
      work_date: new Date('2026-11-30T00:00:00.000Z'),
      work_day: 'Thứ Hai',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T17:00:00.000Z'),
      shift_type: 'OFFICE_HOURS',
      note: 'test',
      employee_id: emp.id,
      employees: { employee_code: 'EMP-001', department: { name: 'Engineering' } },
    })

    await shiftService.assignOrUpdate(
      {
        employee_id: emp.id,
        date: '2026-11-30',
        shift_type: 'OFFICE_HOURS',
        note: 'test',
      },
      'admin-1',
      'ADMIN',
      { allowPastDate: true },
    )

    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    const lockKeys = mocks.txExecuteRaw.mock.calls[0][1] as string[]
    expect(lockKeys).toEqual([
      'payroll:2026-11',
      'payroll:2026-12',
      'employee:emp-uuid-1',
      'attendance:2026-11-29',
      'attendance:2026-11-30',
      'attendance:2026-12-01',
      'shift-type:OFFICE_HOURS',
    ])

    expect(mocks.txShiftsFindFirst).not.toHaveBeenCalled()
    expect(mocks.txShiftsFindMany).toHaveBeenCalledTimes(1)
    const findManyArg = mocks.txShiftsFindMany.mock.calls[0][0]
    expect(findManyArg.where.work_date.in).toEqual([
      new Date('2026-11-29T00:00:00.000Z'),
      new Date('2026-11-30T00:00:00.000Z'),
      new Date('2026-12-01T00:00:00.000Z'),
    ])
  })
})
