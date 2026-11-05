import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js', () => ({ prisma: { attendance_logs: { findFirst: vi.fn() } } }))
vi.mock('../../src/modules/biometrics/public.js', () => ({ findBestFaceMatch: vi.fn(async () => ({ emp_id: 'employee-a', employee_code: 'A', full_name: 'Alice', avatar_url: null, similarity: .95 })) }))
vi.mock('../../src/modules/attendance/attendance.alert-dedup.js', () => ({ claimAlert: vi.fn(async () => true) }))
import { prisma } from '../../src/config/database.js'
import { processThingsBoardWebhook } from '../../src/modules/attendance/attendance.webhook.js'

const actions = { checkIn: vi.fn(), checkOut: vi.fn() } as any
const payload = (event: string, recognition: string) => ({ device_id: 'TEST_PI', mode: 'AUTO', event_id: event, recognition_id: recognition, client_timestamp: Date.now(), event_kind: 'VERIFY_ONLY', antispoof_score: .9, embedding: Array(512).fill(.1) })
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

it('checks out an open overnight check-in from the previous calendar day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T06:00:00+07:00'))
  const checkIn = { type: 'CHECK_IN', event_time: new Date('2026-11-03T22:00:00+07:00') }
  vi.mocked(prisma.attendance_logs.findFirst).mockImplementation(async ({ where }: any) => (
    +checkIn.event_time >= +where.event_time.gte ? checkIn : null
  ) as any)
  expect(await processThingsBoardWebhook(payload('auto-overnight-event', 'auto-overnight-recognition'), actions)).toMatchObject({ mode: 'CHECK_OUT', verification_only: true })
})

it('requires confirmation before granting access during AUTO cooldown', async () => {
  vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue({ type: 'CHECK_IN', event_time: new Date() } as any)
  const result = await processThingsBoardWebhook(payload('auto-cooldown-event', 'auto-cooldown-recognition'), actions)
  expect(result).toMatchObject({ verification_only: true, confirmation_count: 1 })
  expect(result).not.toHaveProperty('door_open', true)
  expect(actions.checkIn).not.toHaveBeenCalled()
  expect(actions.checkOut).not.toHaveBeenCalled()
})

it('resets AUTO confirmation after a rejected PAD', async () => {
  vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue(null)
  await processThingsBoardWebhook(payload('auto-pad-reset-event', 'auto-pad-recognition-1'), actions)
  await processThingsBoardWebhook(payload('auto-pad-reset-event', 'auto-pad-recognition-2'), actions)
  await processThingsBoardWebhook({ ...payload('auto-pad-reset-event', 'auto-pad-recognition-3'), antispoof_score: 0 }, actions)
  expect(await processThingsBoardWebhook(payload('auto-pad-reset-event', 'auto-pad-recognition-4'), actions)).toMatchObject({ verification_only: true, confirmation_count: 1 })
})

it('does not write or open the door for a confirmed scan during cooldown', async () => {
  vi.mocked(prisma.attendance_logs.findFirst).mockResolvedValue({ type: 'CHECK_IN', event_time: new Date() } as any)
  const event = 'auto-confirmed-cooldown'
  await processThingsBoardWebhook(payload(event, 'auto-confirmed-cooldown-1'), actions)
  await processThingsBoardWebhook(payload(event, 'auto-confirmed-cooldown-2'), actions)
  const result = await processThingsBoardWebhook({ ...payload(event, 'auto-confirmed-cooldown-3'), event_kind: 'CONFIRMED_SCAN', expected_employee_id: 'employee-a' }, actions)
  expect(result).toMatchObject({ cooldown: true, door_open: false })
  expect(actions.checkIn).not.toHaveBeenCalled()
  expect(actions.checkOut).not.toHaveBeenCalled()
})

it('uses the same device for IN, OUT, then a new IN after cooldown', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T08:00:00+07:00'))
  let previous: any = null
  vi.mocked(prisma.attendance_logs.findFirst).mockImplementation(async () => previous)
  actions.checkIn.mockImplementation(async () => (previous = { type: 'CHECK_IN', event_time: new Date(), status: 'VALID' }))
  actions.checkOut.mockImplementation(async () => (previous = { type: 'CHECK_OUT', event_time: new Date(), status: 'VALID' }))
  for (const [index, mode] of ['CHECK_IN', 'CHECK_OUT', 'CHECK_IN'].entries()) {
    const event = `auto-cycle-event-${index}`
    await processThingsBoardWebhook(payload(event, `auto-cycle-recognition-${index}-1`), actions)
    await processThingsBoardWebhook(payload(event, `auto-cycle-recognition-${index}-2`), actions)
    const result = await processThingsBoardWebhook({ ...payload(event, `auto-cycle-recognition-${index}-3`), event_kind: 'CONFIRMED_SCAN', expected_employee_id: 'employee-a' }, actions)
    expect(result).toMatchObject({ success: true, door_open: true, mode })
    vi.setSystemTime(new Date(Date.now() + 120_000))
  }
  expect(actions.checkIn).toHaveBeenCalledTimes(2)
  expect(actions.checkOut).toHaveBeenCalledOnce()
})
