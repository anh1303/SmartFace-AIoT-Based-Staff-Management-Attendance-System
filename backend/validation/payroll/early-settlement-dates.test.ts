import { describe, it, expect, vi } from 'vitest'
import { getSettlementLogsAndSummaries } from '../../src/modules/attendance/public.js'

describe('Early Settlement Date Arithmetic & Boundary Tests (P1-4)', () => {
  it('correctly calculates next day as UTC Date for month-end (2026-10-31 -> 2026-11-01) without string overflow', async () => {
    let capturedLogDate: any
    let capturedSummaryDate: any
    let capturedAdjDate: any

    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockImplementation((args: any) => {
          capturedLogDate = args.where.OR[0].work_date.gte
          return Promise.resolve([])
        }),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockImplementation((args: any) => {
          capturedSummaryDate = args.where.work_date.gte
          return Promise.resolve([])
        }),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockImplementation((args: any) => {
          capturedAdjDate = args.where.work_date.gte
          return Promise.resolve([])
        }),
      },
    }

    const cutoffDateVN = '2026-10-31'
    const cutoffDayVN = new Date('2026-10-31T00:00:00+07:00')

    await getSettlementLogsAndSummaries('emp-1', cutoffDateVN, cutoffDayVN, mockTx)

    expect(capturedLogDate).toBeInstanceOf(Date)
    expect(capturedLogDate.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(capturedSummaryDate).toBeInstanceOf(Date)
    expect(capturedSummaryDate.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(capturedAdjDate).toBeInstanceOf(Date)
    expect(capturedAdjDate.toISOString().slice(0, 10)).toBe('2026-11-01')
  })

  it('correctly calculates next day for year-end (2026-12-31 -> 2027-01-01) as Date object', async () => {
    let capturedNextDay: any

    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockImplementation((args: any) => {
          capturedNextDay = args.where.OR[0].work_date.gte
          return Promise.resolve([])
        }),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    const cutoffDateVN = '2026-12-31'
    const cutoffDayVN = new Date('2026-12-31T00:00:00+07:00')

    await getSettlementLogsAndSummaries('emp-1', cutoffDateVN, cutoffDayVN, mockTx)

    expect(capturedNextDay).toBeInstanceOf(Date)
    expect(capturedNextDay.toISOString().slice(0, 10)).toBe('2027-01-01')
  })

  it('correctly handles leap year end of February (2024-02-28 -> 2024-02-29 and 2024-02-29 -> 2024-03-01)', async () => {
    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    // Feb 28 in leap year 2024 -> should be Feb 29
    await getSettlementLogsAndSummaries(
      'emp-1',
      '2024-02-28',
      new Date('2024-02-28T00:00:00+07:00'),
      mockTx
    )
    let callArgs = mockTx.attendance_logs.findMany.mock.calls[0][0]
    expect(callArgs.where.OR[0].work_date.gte).toBeInstanceOf(Date)
    expect(callArgs.where.OR[0].work_date.gte.toISOString().slice(0, 10)).toBe('2024-02-29')

    // Feb 29 in leap year 2024 -> should be March 01
    await getSettlementLogsAndSummaries(
      'emp-1',
      '2024-02-29',
      new Date('2024-02-29T00:00:00+07:00'),
      mockTx
    )
    callArgs = mockTx.attendance_logs.findMany.mock.calls[1][0]
    expect(callArgs.where.OR[0].work_date.gte).toBeInstanceOf(Date)
    expect(callArgs.where.OR[0].work_date.gte.toISOString().slice(0, 10)).toBe('2024-03-01')
  })

  it('correctly handles non-leap year end of February (2026-02-28 -> 2026-03-01)', async () => {
    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    await getSettlementLogsAndSummaries(
      'emp-1',
      '2026-02-28',
      new Date('2026-02-28T00:00:00+07:00'),
      mockTx
    )
    const callArgs = mockTx.attendance_logs.findMany.mock.calls[0][0]
    expect(callArgs.where.OR[0].work_date.gte).toBeInstanceOf(Date)
    expect(callArgs.where.OR[0].work_date.gte.toISOString().slice(0, 10)).toBe('2026-03-01')
  })

  it('correctly handles 30-day month end (2026-04-30 -> 2026-05-01)', async () => {
    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    await getSettlementLogsAndSummaries(
      'emp-1',
      '2026-04-30',
      new Date('2026-04-30T00:00:00+07:00'),
      mockTx
    )
    const callArgs = mockTx.attendance_logs.findMany.mock.calls[0][0]
    expect(callArgs.where.OR[0].work_date.gte).toBeInstanceOf(Date)
    expect(callArgs.where.OR[0].work_date.gte.toISOString().slice(0, 10)).toBe('2026-05-01')
  })

  it('respects caller-provided nextDayInput when supplied as string or Date', async () => {
    const mockTx: any = {
      attendance_logs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      daily_attendance_summary: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceAdjustment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    await getSettlementLogsAndSummaries(
      'emp-1',
      '2026-10-31',
      new Date('2026-10-31T00:00:00+07:00'),
      mockTx,
      '2026-11-01'
    )
    const callArgs = mockTx.attendance_logs.findMany.mock.calls[0][0]
    expect(callArgs.where.OR[0].work_date.gte).toBeInstanceOf(Date)
    expect(callArgs.where.OR[0].work_date.gte.toISOString().slice(0, 10)).toBe('2026-11-01')
  })
})
