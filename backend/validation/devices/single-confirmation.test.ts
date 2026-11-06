import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/modules/biometrics/public.js', () => ({ findBestFaceMatch: vi.fn() }))
vi.mock('../../src/modules/attendance/attendance.alert-dedup.js', () => ({ claimAlert: vi.fn(async () => true) }))
vi.mock('../../src/config/database.js', () => ({ prisma: { attendance_logs: { findFirst: vi.fn() } } }))
import { findBestFaceMatch } from '../../src/modules/biometrics/public.js'
import { processThingsBoardWebhook } from '../../src/modules/attendance/attendance.webhook.js'
import { prisma } from '../../src/config/database.js'

describe('Single-confirmation attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ATTENDANCE_STABLE_COUNT', '1')
    vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue(null)
    vi.mocked(findBestFaceMatch).mockResolvedValue({
      emp_id: 'employee-a', employee_code: 'A', full_name: 'Alice', avatar_url: null,
      embedding_type: 'CENTROID', similarity: .95,
    })
  })
  afterEach(() => vi.unstubAllEnvs())
  const payload = (mode = 'CHECK_IN') => ({
    device_id: 'SINGLE_PI', mode, event_id: `single-${crypto.randomUUID()}`,
    recognition_id: crypto.randomUUID(), client_timestamp: Date.now(),
    event_kind: 'CONFIRMED_SCAN', antispoof_score: .95, embedding: Array(512).fill(.1),
  })
  const actions = () => ({
    checkIn: vi.fn(async () => ({ status: 'VALID' })),
    checkOut: vi.fn(async () => ({ status: 'VALID' })),
  } as any)

  it.each(['CHECK_IN', 'CHECK_OUT'])('records %s on the first verified request without a prior identity', async mode => {
    const writer = actions()
    const result = await processThingsBoardWebhook(payload(mode), writer)
    expect(result).toMatchObject({ success: true, matched: true, door_open: true })
    expect(writer[mode === 'CHECK_IN' ? 'checkIn' : 'checkOut']).toHaveBeenCalledOnce()
    expect(findBestFaceMatch).toHaveBeenCalledOnce()
  })

  it('keeps VERIFY_ONLY read-only even when one recognition is sufficient', async () => {
    const writer = actions()
    expect(await processThingsBoardWebhook({ ...payload(), event_kind: 'VERIFY_ONLY' }, writer))
      .toMatchObject({ verification_only: true, confirmation_required: 1 })
    expect(writer.checkIn).not.toHaveBeenCalled()
  })

  it('requires a prior expected identity when the server requires multiple recognitions', async () => {
    vi.stubEnv('ATTENDANCE_STABLE_COUNT', '2')
    const writer = actions()
    await expect(processThingsBoardWebhook(payload(), writer)).rejects.toThrow(/expected_employee_id/)
    expect(writer.checkIn).not.toHaveBeenCalled()
  })

  it('does not commit a mismatched supplied identity', async () => {
    const writer = actions()
    expect(await processThingsBoardWebhook({ ...payload(), expected_employee_id: 'employee-b' }, writer))
      .toMatchObject({ verification_only: true })
    expect(writer.checkIn).not.toHaveBeenCalled()
  })

  it.each(['spoof', 'unknown'])('does not write an unverified %s scan', async kind => {
    const writer = actions()
    if (kind === 'unknown') vi.mocked(findBestFaceMatch).mockResolvedValue(null)
    expect(await processThingsBoardWebhook({ ...payload(), antispoof_score: kind === 'spoof' ? .1 : .95 }, writer))
      .toMatchObject({ success: false, matched: false })
    expect(writer.checkIn).not.toHaveBeenCalled()
  })

  it('preserves a closed-period rejection from the transactional writer', async () => {
    const writer = actions()
    writer.checkIn.mockResolvedValue({ status: 'FLAGGED', access_denied: true })
    expect(await processThingsBoardWebhook(payload(), writer))
      .toMatchObject({ success: false, matched: true, door_open: false, code: 403 })
  })

  it.each(['CHECK_IN', 'CHECK_OUT'])('resolves AUTO to %s on its first confirmed request', async mode => {
    if (mode === 'CHECK_OUT') vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue({
      type: 'CHECK_IN', event_time: new Date(Date.now() - 600_000),
    } as any)
    const writer = actions()
    expect(await processThingsBoardWebhook(payload('AUTO'), writer))
      .toMatchObject({ success: true, matched: true, door_open: true, mode })
    expect(writer[mode === 'CHECK_IN' ? 'checkIn' : 'checkOut']).toHaveBeenCalledOnce()
  })

  it('preserves AUTO cooldown even with a single recognition', async () => {
    vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue({
      type: 'CHECK_IN', event_time: new Date(),
    } as any)
    const writer = actions()
    expect(await processThingsBoardWebhook(payload('AUTO'), writer))
      .toMatchObject({ success: true, ignored: true, door_open: false, cooldown: true })
    expect(writer.checkIn).not.toHaveBeenCalled()
    expect(writer.checkOut).not.toHaveBeenCalled()
  })

it.each(['CHECK_IN', 'CHECK_OUT'])('recovers a committed AUTO %s acknowledgement during cooldown', async mode => {
  const request = payload('AUTO')
  const event_key = createHash('sha256').update(`${request.device_id}:${request.event_id}`).digest('hex')
  vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue({
    type: mode, event_time: new Date(request.client_timestamp), created_at: new Date(), event_key,
  } as any)
  const writer = actions()
  expect(await processThingsBoardWebhook(request, writer))
    .toMatchObject({ success: true, matched: true, door_open: true, mode, event_id: request.event_id })
  expect(writer[mode === 'CHECK_IN' ? 'checkIn' : 'checkOut']).toHaveBeenCalledOnce()
})

})
