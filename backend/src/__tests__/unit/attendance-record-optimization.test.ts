import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(async () => 0),
  findEmployeeByIdOrCode: vi.fn(),
  findEmployeeWageProfile: vi.fn(),
  isPayrollPeriodClosed: vi.fn(async () => false),
  getEmployeeNearShifts: vi.fn(async () => []),
  aggregateDailyAttendance: vi.fn(),
  logsFindUnique: vi.fn(async () => null),
  logsFindFirst: vi.fn(async () => null),
  logsCreate: vi.fn(async ({ data }: any) => ({
    id: 999n,
    ...data,
    employees: {
      id: data.employee_id,
      user_id: '22222222-2222-4222-8222-222222222222',
      avatar_url: null,
      full_name: 'Nguyen Van A',
      employee_code: 'NV-001',
    },
    created_at: new Date(),
  })),
  publish: vi.fn(),
}))

const {
  executeRaw,
  findEmployeeByIdOrCode,
  findEmployeeWageProfile,
  isPayrollPeriodClosed,
  getEmployeeNearShifts,
  aggregateDailyAttendance,
  logsFindUnique,
  logsFindFirst,
  logsCreate,
  publish,
} = mocks

function createDeferred<T>() {
  let resolve!: (val: T | PromiseLike<T>) => void
  let reject!: (err?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

vi.mock('../../config/database.js', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn({
      $executeRaw: executeRaw,
      attendance_logs: {
        findUnique: logsFindUnique,
        findFirst: logsFindFirst,
        create: logsCreate,
      },
      attendance_locks: { findUnique: vi.fn(async () => null) },
      daily_attendance_summary: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    })),
  },
}))

vi.mock('../../common/event-bus.js', () => ({
  eventBus: { publish },
}))

vi.mock('../../modules/attendance/attendance.aggregation.js', () => ({
  aggregateDailyAttendance: mocks.aggregateDailyAttendance,
}))

vi.mock('../../modules/employees/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/employees/public.js')>()
  return {
    ...actual,
    findEmployeeByIdOrCode,
    findEmployeeWageProfile,
    isEmployeeManager: vi.fn((emp: any) =>
      emp?.users?.roles?.role_name === 'MANAGER' || emp?.position?.level === 'MANAGER',
    ),
    getEmployeeScope: vi.fn(async () => ({})),
    assertCanManageEmployee: vi.fn(async () => {}),
    assertCanAccessEmployeeDetail: vi.fn(async () => {}),
    sourceHourlyRate: vi.fn(() => 50000),
  }
})

vi.mock('../../modules/shifts/public.js', () => ({
  getEmployeeNearShifts,
  getEmployeeShiftsForDateRange: vi.fn(async () => []),
  getEmployeeShiftForDate: vi.fn(async () => null),
  getEmployeeShiftsForRecalculation: vi.fn(async () => []),
  getEmployeeShiftsByFilter: vi.fn(async () => []),
}))

vi.mock('../../modules/attendance/attendance.payroll-port.js', () => ({
  attendancePayroll: () => ({
    isPayrollPeriodClosed,
    getBonusPenaltyPolicy: vi.fn(async () => null),
  }),
}))

vi.mock('../../modules/biometrics/fingerprint.public.js', () => ({
  assertNoFingerprintMaintenance: vi.fn(async () => {}),
  requireFingerprintBinding: vi.fn(async () => {}),
}))

describe('Task 1 & Task 2: acquireAdvisoryLocks & authoritative attendance routing', () => {
  const backgroundErrors: unknown[] = []

  beforeEach(async () => {
    vi.clearAllMocks()
    backgroundErrors.length = 0
    findEmployeeByIdOrCode.mockReset()
    findEmployeeWageProfile.mockReset()
    logsFindUnique.mockReset()
    logsFindFirst.mockReset()
    logsFindUnique.mockResolvedValue(null)
    logsFindFirst.mockResolvedValue(null)
    aggregateDailyAttendance.mockReset()
    aggregateDailyAttendance.mockResolvedValue({
      details: [{ id: 'sum-1', date: '2026-11-24', total_working_hours: 8 }],
    })
    const { setBackgroundAggregationErrorListener } = await import('../../modules/attendance/attendance.service.js')
    setBackgroundAggregationErrorListener((err) => backgroundErrors.push(err))
  })

  afterEach(async () => {
    const { flushBackgroundAggregations, setBackgroundAggregationErrorListener } = await import('../../modules/attendance/attendance.service.js')
    await flushBackgroundAggregations()
    setBackgroundAggregationErrorListener(undefined)
    expect(backgroundErrors).toEqual([])
  })

  it('acquires all ordered advisory locks in a single $executeRaw call while deduplicating keys', async () => {
    const { acquireAdvisoryLocks } = await import('../../common/advisory-lock.js')
    const tx = { $executeRaw: executeRaw } as any
    await acquireAdvisoryLocks(tx, ['payroll:2026-10', 'payroll:2026-11', 'payroll:2026-11', 'payroll:2026-12', 'employee:uuid-1'])
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const [strings, keysArg] = executeRaw.mock.calls[0] as any[]
    expect(strings.join(' ')).toContain('unnest(')
    expect(strings.join(' ')).toContain('WITH ORDINALITY')
    expect(strings.join(' ')).toContain('ORDER BY ord')
    expect(keysArg).toEqual(['payroll:2026-10', 'payroll:2026-11', 'payroll:2026-12', 'employee:uuid-1'])
  })

  it('edgeRequest skips pre-transaction findEmployeeByIdOrCode, attaches immediate recipientMeta (0 extra lookup), and refreshes post-aggregation scope for background summary', async () => {
    const empUuid = '11111111-1111-4111-8111-111111111111'
    const aggBarrier = createDeferred<{ details: any[] }>()
    aggregateDailyAttendance.mockImplementationOnce(() => aggBarrier.promise)

    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: '22222222-2222-4222-8222-222222222222',
      avatar_url: null,
      full_name: 'Nguyen Van A',
      employee_code: 'NV-001',
      departmentId: 5,
      department: { name: 'IT' },
      position: { name: 'Developer', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })

    const { checkIn, flushBackgroundAggregations } = await import('../../modules/attendance/attendance.service.js')
    const { attendanceRecipientRooms } = await import('../../modules/attendance/attendance.recipients.js')

    await checkIn(
      { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
      undefined,
      { eventId: 'evt-1', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, verificationScore: 0.92, livenessScore: 0.95, syncSummary: false },
    )

    expect(findEmployeeByIdOrCode).not.toHaveBeenCalled()
    expect(findEmployeeWageProfile).toHaveBeenCalledWith(empUuid, expect.anything(), 'edge')
    expect(executeRaw).toHaveBeenCalledTimes(1)

    const checkedInCall = publish.mock.calls.find(([evt]) => evt === 'attendance:checked-in')
    expect(checkedInCall?.[1]?.recipientMeta).toEqual({
      id: empUuid,
      departmentId: 5,
      user_id: '22222222-2222-4222-8222-222222222222',
      isManager: false,
    })

    // Before releasing barrier, employee moves to department 12
    findEmployeeByIdOrCode.mockResolvedValueOnce({
      id: empUuid,
      employee_code: 'NV-001',
      user_id: '22222222-2222-4222-8222-222222222222',
      departmentId: 12,
      department: { name: 'Sales' },
      position: { name: 'Sales Exec', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })

    aggBarrier.resolve({ details: [{ id: 'sum-1', date: '2026-11-24', total_working_hours: 8.5 }] })
    await flushBackgroundAggregations()

    const summaryCall = publish.mock.calls.find(([evt]) => evt === 'attendance:summary-updated')
    expect(summaryCall?.[1]?.summary?.details).toEqual([{ id: 'sum-1', date: '2026-11-24', total_working_hours: 8.5 }])
    const summaryRooms = await attendanceRecipientRooms(
      summaryCall?.[1]?.summary,
      summaryCall?.[1]?.recipientMeta,
    )
    expect(summaryRooms).toEqual([
      'ADMIN',
      'department:12',
      `employee:${empUuid}`,
      'user:22222222-2222-4222-8222-222222222222',
    ])
  })

  it('excludes department room on background summary when employee is promoted to MANAGER or deleted before aggregation finishes', async () => {
    const empUuid = '11111111-1111-4111-8111-111111111111'
    const { checkOut, flushBackgroundAggregations } = await import('../../modules/attendance/attendance.service.js')
    const { attendanceRecipientRooms } = await import('../../modules/attendance/attendance.recipients.js')

    // Case A: Promoted to MANAGER while background aggregation runs
    const barrier1 = createDeferred<{ details: any[] }>()
    aggregateDailyAttendance.mockImplementationOnce(() => barrier1.promise)
    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: 'u-1',
      avatar_url: null,
      full_name: 'A',
      employee_code: 'NV-001',
      departmentId: 5,
      department: { name: 'IT' },
      position: { name: 'Staff', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })
    await checkOut(
      { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
      undefined,
      undefined,
      { eventId: 'evt-out-1', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, syncSummary: false },
    )
    findEmployeeByIdOrCode.mockResolvedValueOnce({
      id: empUuid,
      employee_code: 'NV-001',
      user_id: 'u-1',
      departmentId: 5,
      position: { name: 'Manager', level: 'MANAGER' },
      users: { roles: { role_name: 'MANAGER' } },
    })
    barrier1.resolve({ details: [] })
    await flushBackgroundAggregations()

    const promotedSummary = publish.mock.calls.find(([evt]) => evt === 'attendance:summary-updated')
    expect(await attendanceRecipientRooms(promotedSummary?.[1]?.summary, promotedSummary?.[1]?.recipientMeta)).toEqual([
      'ADMIN',
      `employee:${empUuid}`,
      'user:u-1',
    ])

    // Case B: Employee no longer found when summary finishes -> ADMIN only (0 extra DB query)
    publish.mockClear()
    findEmployeeByIdOrCode.mockReset()
    const barrier2 = createDeferred<{ details: any[] }>()
    aggregateDailyAttendance.mockImplementationOnce(() => barrier2.promise)
    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: 'u-1',
      avatar_url: null,
      full_name: 'A',
      employee_code: 'NV-001',
      departmentId: 5,
      department: { name: 'IT' },
      position: { name: 'Staff', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })
    await checkOut(
      { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
      undefined,
      undefined,
      { eventId: 'evt-out-2', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, syncSummary: false },
    )
    findEmployeeByIdOrCode.mockResolvedValueOnce(null)
    barrier2.resolve({ details: [] })
    await flushBackgroundAggregations()

    expect(findEmployeeByIdOrCode).toHaveBeenCalledTimes(1)
    const deletedSummary = publish.mock.calls.find(([evt]) => evt === 'attendance:summary-updated')
    expect(deletedSummary?.[1]?.recipientMeta).toBeNull()
    expect(await attendanceRecipientRooms(deletedSummary?.[1]?.summary, deletedSummary?.[1]?.recipientMeta)).toEqual(['ADMIN'])
    // Passing null recipientMeta must NOT trigger a second DB lookup
    expect(findEmployeeByIdOrCode).toHaveBeenCalledTimes(1)
  })

  it('manual check-in uses authoritative in-transaction employee scope (Dept B) instead of stale pre-transaction read (Dept A), without pulling avatar_url twice', async () => {
    const empUuid = '33333333-3333-4333-8333-333333333333'
    findEmployeeByIdOrCode.mockResolvedValueOnce({
      id: empUuid,
      employee_code: 'NV-009',
      status: 'ACTIVE',
      user_id: '44444444-4444-4444-8444-444444444444',
      departmentId: 1,
      department: { name: 'Dept A' },
      position: { name: 'Staff', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })

    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 60000,
      hourly_rate_history: [],
      user_id: '44444444-4444-4444-8444-444444444444',
      full_name: 'Tran Thi B',
      employee_code: 'NV-009',
      departmentId: 9,
      department: { name: 'Dept B' },
      position: { name: 'Staff', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })

    const { checkIn } = await import('../../modules/attendance/attendance.service.js')
    await checkIn(
      { employeeId: 'NV-009', method: 'MANUAL' },
      { id: 'admin-1', role: 'ADMIN' },
      { reason: 'Quên thẻ', syncSummary: true },
    )

    expect(findEmployeeWageProfile).toHaveBeenCalledWith(empUuid, expect.anything(), 'routing')
    const checkedInCall = publish.mock.calls.find(([evt]) => evt === 'attendance:checked-in')
    expect(checkedInCall?.[1]?.recipientMeta).toEqual({
      id: empUuid,
      departmentId: 9,
      user_id: '44444444-4444-4444-8444-444444444444',
      isManager: false,
    })
  })

  it('preserves cooldown (ignored: true, nochecked-in event) and idempotent eventId replay (duplicate: true, no duplicate checked-in event)', async () => {
    const empUuid = '55555555-5555-4555-8555-555555555555'
    const { checkIn } = await import('../../modules/attendance/attendance.service.js')

    // 1. Cooldown active -> ignored: true, 0 domain events published
    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: 'u-5',
      avatar_url: null,
      full_name: 'Cooldown Emp',
      employee_code: 'NV-005',
      departmentId: 3,
      department: { name: 'HR' },
      position: { name: 'HR', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })
    logsFindFirst.mockResolvedValueOnce({
      id: 77n,
      employee_id: empUuid,
      type: 'CHECK_IN',
      event_time: new Date(),
      work_date: new Date('2026-11-24T00:00:00Z'),
      created_at: new Date(), // just created -> within cooldown interval
    })

    const cooldownRes = await checkIn(
      { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
      undefined,
      { eventId: 'evt-cool', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, syncSummary: false },
    )
    expect(cooldownRes.ignored).toBe(true)
    expect(cooldownRes.cooldown).toBe(true)
    expect(publish).not.toHaveBeenCalled()

    // 2. Idempotent replay of existing event_key -> duplicate: true, does not emit checked-in again
    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: 'u-5',
      avatar_url: null,
      full_name: 'Cooldown Emp',
      employee_code: 'NV-005',
      departmentId: 3,
      department: { name: 'HR' },
      position: { name: 'HR', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })
    logsFindUnique.mockResolvedValueOnce({
      id: 88n,
      employee_id: empUuid,
      type: 'CHECK_IN',
      status: 'VALID',
      method: 'FACE',
      device_info: 'device:PI4_FRONT_GATE',
      event_time: new Date('2026-11-24T01:00:00Z'),
      work_date: new Date('2026-11-24T00:00:00Z'),
      created_at: new Date('2026-11-24T01:00:00Z'),
      employees: { id: empUuid, employee_code: 'NV-005', full_name: 'Cooldown Emp', user_id: 'u-5', avatar_url: null },
    })

    const replayRes = await checkIn(
      { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
      undefined,
      { eventId: 'evt-replay', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, syncSummary: false },
    )
    expect(replayRes.duplicate).toBe(true)
    expect(publish.mock.calls.find(([evt]) => evt === 'attendance:checked-in')).toBeUndefined()
  })

  it('surfaces background aggregation failures via setBackgroundAggregationErrorListener so tests fail when background work breaks', async () => {
    const empUuid = '66666666-6666-4666-8666-666666666666'
    const { checkIn, flushBackgroundAggregations } = await import('../../modules/attendance/attendance.service.js')
    findEmployeeWageProfile.mockResolvedValueOnce({
      id: empUuid,
      status: 'ACTIVE',
      hourly_rate: 50000,
      hourly_rate_history: [],
      user_id: 'u-6',
      avatar_url: null,
      full_name: 'Err Emp',
      employee_code: 'NV-006',
      departmentId: 3,
      department: { name: 'HR' },
      position: { name: 'HR', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    })
    aggregateDailyAttendance.mockRejectedValueOnce(new Error('simulated-agg-failure'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await checkIn(
        { employeeId: empUuid, device_info: 'device:PI4_FRONT_GATE', method: 'FACE' },
        undefined,
        { eventId: 'evt-err', capturedAt: Date.now(), deviceId: 'PI4_FRONT_GATE', verified: true, syncSummary: false },
      )
      await flushBackgroundAggregations()
      expect(backgroundErrors).toHaveLength(1)
      expect((backgroundErrors[0] as Error).message).toBe('simulated-agg-failure')
      // Clear after verifying so afterEach assertion passes cleanly
      backgroundErrors.length = 0
    } finally {
      errSpy.mockRestore()
    }
  })
})
