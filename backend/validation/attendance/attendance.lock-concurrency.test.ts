import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(async () => 1),
  $transaction: vi.fn(),
  daily_attendance_summary: { findMany: vi.fn(), update: vi.fn() },
  attendance_locks: { findUnique: vi.fn(), upsert: vi.fn() },
  payrollPeriod: { findMany: vi.fn() },
  attendanceAggregationState: { findUnique: vi.fn() },
  employee_shifts: { findMany: vi.fn() },
  payrollPeriodClosedEmployee: { findMany: vi.fn() },
  bonusPenalty: { findFirst: vi.fn(async () => null) },
  auditLog: { create: vi.fn(async () => ({})) },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

const mockAgg = vi.hoisted(() => vi.fn())
vi.mock('../../src/modules/attendance/attendance.aggregation.js', () => ({
  aggregateDailyAttendance: mockAgg,
}))

import { adjustAttendance, toggleLock } from '../../src/modules/attendance/attendance.service.js'

describe('Attendance lock concurrency and recalculation safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgg.mockReset()
    db.$transaction.mockImplementation(async (cb: any) => cb(db))
    db.payrollPeriodClosedEmployee.findMany.mockResolvedValue([])
    db.attendanceAggregationState.findUnique.mockResolvedValue({ period: '2026-11', failed: false })
  })

  it('recalculates an adjustment inside the locked transaction', async () => {
    mockAgg.mockRejectedValueOnce(new Error('stop after aggregation'))
    await expect(adjustAttendance({ employeeId: 'emp-1', date: '2026-11-01', late_early: 0, overtime: 0, reason: 'review' })).rejects.toThrow('stop after aggregation')
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(db.$executeRaw).toHaveBeenCalledTimes(2)
    expect(mockAgg).toHaveBeenCalledWith(11, 2026, 'emp-1', '2026-11-01', undefined, db)
  })

  it('rejects toggleLock if any assigned shift is missing a daily attendance summary', async () => {
    db.employee_shifts.findMany.mockResolvedValueOnce([
      { employee_id: 'emp-1' },
      { employee_id: 'emp-2' }, // Missing summary
    ])
    db.daily_attendance_summary.findMany.mockResolvedValueOnce([
      { id: 1n, employee_id: 'emp-1', work_date: new Date('2026-11-01T00:00:00Z'), review_status: 'PENDING', requires_review: false },
    ])

    await expect(
      toggleLock('2026-11-01', true, 'admin-1', 'ADMIN')
    ).rejects.toMatchObject({
      message: expect.stringContaining('chưa có bản tổng hợp'),
    })
  })

  it('rejects toggleLock if a summary is pending recalculation due to shift change', async () => {
    db.employee_shifts.findMany.mockResolvedValueOnce([
      { employee_id: 'emp-1' },
    ])
    db.daily_attendance_summary.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        employee_id: 'emp-1',
        work_date: new Date('2026-11-01T00:00:00Z'),
        review_status: 'PENDING',
        requires_review: true,
        review_reason: 'SHIFT_CHANGED',
      },
    ])

    await expect(
      toggleLock('2026-11-01', true, 'admin-1', 'ADMIN')
    ).rejects.toMatchObject({
      message: expect.stringContaining('chờ tính lại sau khi đổi ca'),
    })
  })

  it('executes aggregateDailyAttendance with tx inside the advisory locked transaction when locking', async () => {
    db.employee_shifts.findMany.mockResolvedValueOnce([
      { employee_id: 'emp-1' },
    ])
    db.daily_attendance_summary.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        employee_id: 'emp-1',
        work_date: new Date('2026-11-01T00:00:00Z'),
        review_status: 'APPROVED',
        requires_review: false,
        reopened_at: null,
      },
    ])
    db.attendance_locks.upsert.mockResolvedValueOnce({ work_date: new Date('2026-11-01T00:00:00Z'), is_locked: true })

    await toggleLock('2026-11-01', true, 'admin-1', 'ADMIN')

    // Expect aggregateDailyAttendance to have been passed tx
    expect(mockAgg).toHaveBeenCalledWith(
      11,
      2026,
      undefined,
      '2026-11-01',
      undefined,
      expect.anything() // tx must be passed
    )
  })
})
