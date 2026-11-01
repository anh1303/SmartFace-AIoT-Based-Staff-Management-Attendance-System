import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

const state = vi.hoisted(() => ({
  publishedEvents: [] as Array<{ event: string; data: any }>,
}))

vi.mock('../../src/common/event-bus.js', () => ({
  eventBus: {
    publish: vi.fn((event: string, data: any) => {
      state.publishedEvents.push({ event, data })
    }),
  },
}))

vi.mock('../../src/config/database.js', () => {
  const mockTx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => []),
    attendance_logs: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({
        id: randomUUID(),
        ...data,
        event_time: new Date(),
        work_date: new Date(),
      })),
    },
    employee: {
      findFirst: vi.fn(async () => ({
        id: 'emp-1',
        employee_code: 'EMP001',
        full_name: 'Test Staff',
        status: 'ACTIVE',
      })),
    },
    daily_attendance_summary: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: 'sum-1' })),
    },
    employee_shifts: {
      findMany: vi.fn(async () => []),
    },
    attendance_locks: {
      findUnique: vi.fn(async () => null),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
    },
  }
  return {
    prisma: {
      ...mockTx,
      $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    },
  }
})

vi.mock('../../src/modules/attendance/attendance.aggregation.js', () => ({
  aggregateDailyAttendance: vi.fn(async () => ({ details: [] })),
}))

vi.mock('../../src/modules/employees/public.js', () => ({
  findEmployeeByIdOrCode: vi.fn(async () => ({
    id: 'emp-1',
    employee_code: 'EMP001',
    full_name: 'Test Staff',
    status: 'ACTIVE',
  })),
  findEmployeeByUserId: vi.fn(async () => null),
  findEmployeeWageProfile: vi.fn(async () => ({
    id: 'emp-1',
    employee_code: 'EMP001',
    full_name: 'Test Staff',
    status: 'ACTIVE',
    hourly_rate: 100000,
  })),
  assertCanManageEmployee: vi.fn(async () => true),
}))

import { checkIn } from '../../src/modules/attendance/attendance.service.js'
import { prisma } from '../../src/config/database.js'

describe('Attendance event emission single-pathway and transactional safety', () => {
  beforeEach(() => {
    state.publishedEvents = []
    vi.clearAllMocks()
  })

  it('publishes exactly one check-in event and one summary event after transaction commits', async () => {
    const eventId = randomUUID()
    const result = await checkIn(
      { employeeId: 'emp-1', method: 'FACE' },
      undefined,
      { eventId, capturedAt: Date.now() }
    )

    expect(result).toBeDefined()
    const checkInEvents = state.publishedEvents.filter(e => e.event === 'attendance:checked-in')
    expect(checkInEvents).toHaveLength(1)
    expect(checkInEvents[0].data.employeeId).toBe('emp-1')

    const summaryEvents = state.publishedEvents.filter(e => e.event === 'attendance:summary-updated')
    expect(summaryEvents).toHaveLength(1)
  })

  it('does NOT emit events if the database transaction rolls back', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB Constraint Violation'))

    await expect(
      checkIn({ employeeId: 'emp-1', method: 'FACE' }, undefined, { eventId: randomUUID(), capturedAt: Date.now() })
    ).rejects.toThrow('DB Constraint Violation')

    expect(state.publishedEvents).toHaveLength(0)
  })
})
