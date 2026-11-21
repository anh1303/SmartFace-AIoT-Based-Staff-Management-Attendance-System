import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  aggregateDailyAttendance: vi.fn().mockResolvedValue({ totalSummaries: 0 }),
  autoCloseDueAttendance: vi.fn().mockResolvedValue({ closedCount: 0, absentConvertedCount: 0 }),
  autoLockCompletedAttendanceDates: vi.fn().mockResolvedValue(0),
  runMissingScanAlerts: vi.fn().mockResolvedValue({ checked: 0, notified: 0 }),
  executeRaw: vi.fn().mockResolvedValue(0),
  transaction: vi.fn(async (fn: any) => fn({
    $executeRaw: vi.fn().mockResolvedValue(0),
    attendanceAggregationState: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    systemNotification: { upsert: vi.fn().mockResolvedValue({}) },
  })),
}))

vi.mock('../../modules/attendance/attendance.service.js', () => ({
  aggregateDailyAttendance: mocks.aggregateDailyAttendance,
  autoCloseDueAttendance: mocks.autoCloseDueAttendance,
  autoLockCompletedAttendanceDates: mocks.autoLockCompletedAttendanceDates,
}))
vi.mock('../../modules/attendance/attendance.missing-alerts.js', () => ({
  runMissingScanAlerts: mocks.runMissingScanAlerts,
}))
vi.mock('../../config/database.js', () => ({
  prisma: {
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
  },
}))
vi.mock('../../modules/auth/public.js', () => ({
  findActiveAdminUserIds: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../common/logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

import { startAttendanceCron, stopAttendanceCron } from '../../modules/attendance/attendance.cron.js'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  stopAttendanceCron()
  vi.useRealTimers()
})

describe('attendance cron Neon-idle & schedule preservation', () => {
  it('does not poll missing-scan alerts every 60s during a 10-minute idle window under default schedule', async () => {
    vi.useFakeTimers()
    // 10:00 VN = 03:00 UTC (far from 00:05 VN)
    vi.setSystemTime(new Date('2026-11-21T03:00:00.000Z'))

    startAttendanceCron()
    // Startup catch-up runs at 10s
    await vi.advanceTimersByTimeAsync(11_000)
    expect(mocks.runMissingScanAlerts).toHaveBeenCalledTimes(1)

    // Advance 10 minutes: must remain idle (0 extra alert queries so Neon can suspend)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(mocks.runMissingScanAlerts).toHaveBeenCalledTimes(1)

    // Advance past 15 minutes total: scheduled alert scan runs once
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(mocks.runMissingScanAlerts).toHaveBeenCalledTimes(2)
  })

  it('still triggers the exact 00:05 VN auto-close and aggregation schedule and cleans up on stop', async () => {
    vi.useFakeTimers()
    // 00:03 VN = 17:03 UTC previous day -> 2 minutes before 00:05 VN
    vi.setSystemTime(new Date('2026-11-21T17:03:00.000Z'))

    startAttendanceCron(30 * 60 * 1000, 15 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(11_000)
    const closeAfterStartup = mocks.autoCloseDueAttendance.mock.calls.length

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(mocks.autoCloseDueAttendance.mock.calls.length).toBeGreaterThan(closeAfterStartup)

    stopAttendanceCron()
    const callsAtStop = mocks.runMissingScanAlerts.mock.calls.length
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(mocks.runMissingScanAlerts.mock.calls.length).toBe(callsAtStop)
  })
})
