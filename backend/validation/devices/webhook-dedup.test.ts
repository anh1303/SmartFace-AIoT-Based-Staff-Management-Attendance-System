import { describe, it, expect, vi, beforeEach } from 'vitest'

const claims = vi.hoisted(() => new Set<string>())
vi.mock('../../src/modules/attendance/attendance.alert-dedup.js', () => ({
  claimAlert: vi.fn(async (...parts: string[]) => {
    const key = JSON.stringify(parts)
    if (claims.has(key)) return false
    claims.add(key)
    return true
  }),
}))

const mockPublish = vi.fn()
vi.mock('../../src/common/event-bus.js', () => ({
  eventBus: {
    publish: (...args: any[]) => mockPublish(...args),
    subscribe: vi.fn(),
  },
}))

vi.mock('../../src/modules/biometrics/public.js', () => ({
  findBestFaceMatch: vi.fn(),
}))

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $queryRaw: vi.fn(async () => []),
    employee: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ id: 'EMP_001' }]),
    },
  },
}))

import { processThingsBoardWebhook } from '../../src/modules/attendance/attendance.webhook.js'

describe('Webhook alert deduplication on replayed / duplicate requests (P2-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    claims.clear()
  })

  it('does NOT emit duplicate attendance:spoof-blocked alerts for the same device and event_id', async () => {
    const payload = {
      device_id: 'GATE_01',
      mode: 'CHECK_IN',
      event_id: 'spoof-duplicate-event-1',
      client_timestamp: Date.now(),
      antispoof_score: 0.1,
    }

    const mockActions = {
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    } as any

    // First spoof request
    const res1 = await processThingsBoardWebhook(payload, mockActions)
    expect(res1.success).toBe(false)
    expect(mockPublish).toHaveBeenCalledTimes(1)
    expect(mockPublish).toHaveBeenCalledWith('attendance:spoof-blocked', expect.objectContaining({
      device_id: 'GATE_01',
      event_id: 'spoof-duplicate-event-1',
    }))

    // Replayed spoof request with same event_id
    const res2 = await processThingsBoardWebhook(payload, mockActions)
    expect(res2.success).toBe(false)
    // MUST NOT emit duplicate alert
    expect(mockPublish).toHaveBeenCalledTimes(1)
  })

  it('does NOT emit duplicate attendance:unknown alerts for the same device and event_id', async () => {
    const payload = {
      device_id: 'GATE_01',
      mode: 'CHECK_IN',
      event_id: 'unknown-duplicate-event-1',
      client_timestamp: Date.now(),
      event_kind: 'VERIFY_ONLY',
      recognition_id: 'recog-unknown-123',
      antispoof_score: 0.95,
      embedding: Array(512).fill(0.01),
    }

    const mockActions = {
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    } as any

    // First unknown face scan
    const res1 = await processThingsBoardWebhook(payload, mockActions)
    expect(res1.matched).toBe(false)
    expect(mockPublish).toHaveBeenCalledTimes(1)
    expect(mockPublish).toHaveBeenCalledWith('attendance:unknown', expect.objectContaining({
      device_id: 'GATE_01',
      event_id: 'unknown-duplicate-event-1',
    }))

    // Replayed unknown face scan with same event_id
    const res2 = await processThingsBoardWebhook(payload, mockActions)
    expect(res2.matched).toBe(false)
    // MUST NOT emit duplicate alert
    expect(mockPublish).toHaveBeenCalledTimes(1)
  })

  it('does NOT emit duplicate attendance:flagged alert when attendance record has duplicate: true', async () => {
    const { findBestFaceMatch } = await import('../../src/modules/biometrics/public.js')
    vi.mocked(findBestFaceMatch).mockResolvedValue({
      emp_id: 'EMP_001',
      employee_code: 'NV01',
      full_name: 'Nguyen Van A',
      avatar_url: null,
      embedding_type: 'CENTROID',
      similarity: 0.95,
    })

    const payload = {
      device_id: 'GATE_01',
      mode: 'CHECK_IN',
      event_id: 'flagged-duplicate-event-1',
      client_timestamp: Date.now(),
      event_kind: 'CONFIRMED_SCAN',
      recognition_id: 'recog-flagged-123',
      expected_employee_id: 'EMP_001',
      antispoof_score: 0.95,
      embedding: Array(512).fill(0.05),
    }

    // Step 1: Prime confirmation
    await processThingsBoardWebhook({
      ...payload,
      event_kind: 'VERIFY_ONLY',
    }, {} as any)
    await processThingsBoardWebhook({
      ...payload,
      event_kind: 'VERIFY_ONLY',
      recognition_id: 'recog-flagged-124',
    }, {} as any)

    // First confirmed scan returns FLAGGED record with duplicate: false
    const mockActions1 = {
      checkIn: vi.fn().mockResolvedValue({
        id: 'rec-1',
        status: 'FLAGGED',
        duplicate: false,
      }),
      checkOut: vi.fn(),
    } as any

    const first = await processThingsBoardWebhook({
      ...payload,
      recognition_id: 'recog-flagged-125',
    }, mockActions1)
    expect(first).toMatchObject({ success: false, door_open: false })

    expect(mockPublish).toHaveBeenCalledWith('attendance:flagged', expect.objectContaining({
      device_id: 'GATE_01',
      event_id: 'flagged-duplicate-event-1',
      employee_id: 'EMP_001',
    }))
    const publishCountAfterFirst = mockPublish.mock.calls.filter((c: any) => c[0] === 'attendance:flagged').length
    expect(publishCountAfterFirst).toBe(1)

    // Prime confirmation for replay test
    await processThingsBoardWebhook({
      ...payload,
      event_kind: 'VERIFY_ONLY',
      recognition_id: 'recog-replay-1',
    }, {} as any)
    await processThingsBoardWebhook({
      ...payload,
      event_kind: 'VERIFY_ONLY',
      recognition_id: 'recog-replay-2',
    }, {} as any)

    // Replay returns FLAGGED record with duplicate: true
    const mockActions2 = {
      checkIn: vi.fn().mockResolvedValue({
        id: 'rec-1',
        status: 'FLAGGED',
        duplicate: true,
      }),
      checkOut: vi.fn(),
    } as any

    const replay = await processThingsBoardWebhook({
      ...payload,
      recognition_id: 'recog-replay-3',
    }, mockActions2)
    expect(replay).toMatchObject({ success: false, door_open: false })

    // attendance:flagged MUST NOT be called again
    const publishCountAfterReplay = mockPublish.mock.calls.filter((c: any) => c[0] === 'attendance:flagged').length
    expect(publishCountAfterReplay).toBe(1)

    for (const recognition_id of ['locked-replay-1', 'locked-replay-2']) {
      await processThingsBoardWebhook({ ...payload, event_kind: 'VERIFY_ONLY', recognition_id }, {} as any)
    }
    const lockedReplay = await processThingsBoardWebhook({ ...payload, recognition_id: 'locked-replay-3' }, {
      checkIn: vi.fn().mockResolvedValue({ id: 'old-valid', status: 'VALID', duplicate: true, access_denied: true }),
      checkOut: vi.fn(),
    } as any)
    expect(lockedReplay).toMatchObject({ success: false, door_open: false })
    expect(mockPublish.mock.calls.filter((c: any) => c[0] === 'attendance:flagged')).toHaveLength(1)
  })
})
