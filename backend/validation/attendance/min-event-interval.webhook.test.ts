import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const publish = vi.hoisted(() => vi.fn())
vi.mock('../../src/config/database.js', () => ({ prisma: { attendance_logs: { findFirst: vi.fn() } } }))
vi.mock('../../src/common/event-bus.js', () => ({ eventBus: { publish } }))
vi.mock('../../src/modules/biometrics/public.js', () => ({ findBestFaceMatch: vi.fn(async () => ({ emp_id: 'employee-a', employee_code: 'A', full_name: 'Alice', avatar_url: null, similarity: .95 })) }))
import { processThingsBoardWebhook } from '../../src/modules/attendance/attendance.webhook.js'

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ATTENDANCE_STABLE_COUNT', '1') })
afterEach(() => vi.unstubAllEnvs())

it.each(['CHECK_IN', 'CHECK_OUT'])('returns a successful ignored %s response without granting access or publishing an event', async mode => {
  const ignored = { status: 'VALID', ignored: true, duplicate: true, retry_after_seconds: 540, message: 'Already recorded; wait 540s' }
  const actions = { checkIn: vi.fn(async () => ignored), checkOut: vi.fn(async () => ignored) }
  const result = await processThingsBoardWebhook({
    device_id: 'device-test', mode, event_id: `interval-event-${mode}`, event_kind: 'CONFIRMED_SCAN',
    recognition_id: `interval-recognition-${mode}`, client_timestamp: Date.now(),
    antispoof_score: .9, embedding: Array(512).fill(.1),
  }, actions as any)
  expect(result).toMatchObject({ success: true, matched: true, ignored: true, cooldown: true, door_open: false, mode, retry_after_seconds: 540, message: ignored.message })
  expect(actions[mode === 'CHECK_IN' ? 'checkIn' : 'checkOut']).toHaveBeenCalledOnce()
  expect(actions[mode === 'CHECK_IN' ? 'checkOut' : 'checkIn']).not.toHaveBeenCalled()
  expect(publish).not.toHaveBeenCalled()
})
