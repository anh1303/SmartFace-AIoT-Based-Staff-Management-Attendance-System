import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $executeRaw: vi.fn(async () => 1),
  attendance_locks: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  employee_shifts: { findMany: vi.fn() },
  daily_attendance_summary: { findMany: vi.fn() },
  attendanceAggregationState: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
import { autoLockAttendanceDate, autoLockCompletedAttendanceDates } from '../../src/modules/attendance/attendance.service.js'

describe('automatic daily attendance lock', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.$transaction.mockImplementation(async (callback: any) => callback(db))
    db.attendance_locks.findUnique.mockResolvedValue(null)
    db.attendanceAggregationState.findUnique.mockResolvedValue(null)
    db.employee_shifts.findMany.mockResolvedValue([{ employee_id: 'a', shift_type: 'MORNING' }])
    db.daily_attendance_summary.findMany.mockResolvedValue([{ employee_id: 'a', review_status: 'APPROVED' }])
    db.attendance_locks.upsert.mockResolvedValue({})
  })

  it('locks a completed day from 00:05 Vietnam time', async () => {
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-04T17:04:59Z'))).toBe(false)
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-04T17:05:00Z'))).toBe(true)
    expect(db.attendance_locks.upsert).toHaveBeenCalledOnce()
  })

  it('waits for all assigned shifts to be approved', async () => {
    db.employee_shifts.findMany.mockResolvedValue([{ employee_id: 'a', shift_type: 'MORNING' }, { employee_id: 'b', shift_type: 'OTHER' }])
    db.daily_attendance_summary.findMany.mockResolvedValue([{ employee_id: 'a', review_status: 'APPROVED' }, { employee_id: 'b', review_status: 'PENDING' }])
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-04T17:05:00Z'))).toBe(false)
    expect(db.attendance_locks.upsert).not.toHaveBeenCalled()
  })

  it('waits if an approved overnight shift has not ended yet', async () => {
    db.daily_attendance_summary.findMany.mockResolvedValue([{ employee_id: 'a', review_status: 'APPROVED', calculation_details: { scheduledEnd: '2026-11-05T00:00:00Z' } }])
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-04T17:05:00Z'))).toBe(false)
    expect(db.attendance_locks.upsert).not.toHaveBeenCalled()
  })

  it('relocks a previously reopened day after its protection expires', async () => {
    db.attendance_locks.findUnique.mockResolvedValue({ is_locked: false, locked_at: new Date('2026-11-05T02:00:00Z') })
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-06T02:00:00Z'))).toBe(true)
  })

  it('does not lock when attendance aggregation failed', async () => {
    db.attendanceAggregationState.findUnique.mockResolvedValue({ failed: true })
    expect(await autoLockAttendanceDate('2026-11-04', new Date('2026-11-04T17:05:00Z'))).toBe(false)
    expect(db.attendance_locks.upsert).not.toHaveBeenCalled()
  })

  it('finds unlocked earlier days again after a restart', async () => {
    db.attendance_locks.findMany.mockResolvedValue([])
    db.employee_shifts.findMany
      .mockResolvedValueOnce([{ employee_id: 'a', shift_type: 'MORNING', work_date: new Date('2026-11-04T00:00:00Z') }])
      .mockResolvedValueOnce([{ employee_id: 'a', shift_type: 'MORNING' }])
    expect(await autoLockCompletedAttendanceDates(new Date('2026-11-06T02:00:00Z'))).toBe(1)
    expect(db.attendance_locks.upsert).toHaveBeenCalledOnce()
  })

  it('does not relock a recently reopened day or a day with only OFF shifts', async () => {
    const now = new Date('2026-11-05T03:00:00Z')
    db.attendance_locks.findUnique.mockResolvedValue({ is_locked: false, locked_at: new Date('2026-11-05T02:00:00Z') })
    expect(await autoLockAttendanceDate('2026-11-04', now)).toBe(false)
    db.attendance_locks.findUnique.mockResolvedValue(null)
    db.employee_shifts.findMany.mockResolvedValue([{ employee_id: 'a', shift_type: 'OFF' }])
    expect(await autoLockAttendanceDate('2026-11-04', now)).toBe(false)
    expect(db.attendance_locks.upsert).not.toHaveBeenCalled()
  })
})
