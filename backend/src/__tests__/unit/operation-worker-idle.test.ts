import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }))
const gateway = vi.hoisted(() => ({ announceOperation: vi.fn() }))
vi.mock('../../config/database.js', () => ({ prisma: db }))
vi.mock('../../modules/operations/operation.gateway.js', () => gateway)
vi.mock('../../common/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('../../modules/auth/public.js', () => ({ findAuthUserById: vi.fn() }))

import {
  currentActor,
  registerOperationHandler,
  setOperationActorLookup,
  startOperationWorker,
  stopOperationWorker,
  wakeOperationWorker,
} from '../../modules/operations/operation.worker.js'

const makeJob = (id: string) => ({
  id,
  owner_id: 'owner-1',
  type: 'idle.test',
  lease_token: `lease-${id}`,
  status: 'running',
})

beforeEach(() => {
  vi.resetAllMocks()
  db.$executeRaw.mockResolvedValue(1)
})

afterEach(async () => {
  await stopOperationWorker()
  vi.useRealTimers()
})

describe('operation worker Neon-idle & queue-drain contract', () => {
  it('stays completely idle for 10+ minutes without polling Neon every second, then runs recovery tick on schedule', async () => {
    vi.useFakeTimers()
    db.$queryRaw.mockResolvedValue([])

    startOperationWorker()
    // Allow startup recovery tick to run once if scheduled immediately
    await vi.advanceTimersByTimeAsync(2000)
    const callsAfterStartup = db.$queryRaw.mock.calls.length + db.$executeRaw.mock.calls.length

    // Advance 10 minutes (> Neon 5-min default suspend window): zero idle DB queries allowed
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(db.$queryRaw.mock.calls.length + db.$executeRaw.mock.calls.length).toBe(callsAfterStartup)

    // Advancing past the 15-minute recovery window runs exactly one recovery + TTL cleanup pass
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(db.$executeRaw.mock.calls.length).toBeGreaterThan(0)
    expect(db.$queryRaw.mock.calls.length + db.$executeRaw.mock.calls.length).toBeGreaterThan(callsAfterStartup)
  })

  it('drains multiple queued jobs back-to-back from a single wake without waiting for the recovery timer', async () => {
    vi.useFakeTimers()
    const handled: string[] = []
    db.$queryRaw
      // Initial startup tick finds nothing
      .mockResolvedValueOnce([])
      // Single wake drains job-1, job-2, job-3 back-to-back, then stops when queue is empty
      .mockResolvedValueOnce([makeJob('job-1')])
      .mockResolvedValueOnce([{ status: 'succeeded' }])
      .mockResolvedValueOnce([makeJob('job-2')])
      .mockResolvedValueOnce([{ status: 'succeeded' }])
      .mockResolvedValueOnce([makeJob('job-3')])
      .mockResolvedValueOnce([{ status: 'succeeded' }])
      .mockResolvedValueOnce([])

    registerOperationHandler('idle.test', async claimed => {
      handled.push(claimed.id)
    })

    startOperationWorker(15 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(2000)

    wakeOperationWorker()
    // Only advance a few ms (nowhere near 15 minutes): all 3 jobs must complete
    await vi.advanceTimersByTimeAsync(100)
    expect(handled).toEqual(['job-1', 'job-2', 'job-3'])
    expect(gateway.announceOperation).toHaveBeenCalledTimes(3)
  })

  it('enforces actor active status and ADMIN/MANAGER role at execution time', async () => {
    setOperationActorLookup(async id =>
      id === 'disabled-admin'
        ? { id, is_active: false, roles: { role_name: 'ADMIN' } }
        : { id, is_active: true, roles: { role_name: 'EMPLOYEE' } }
    )

    await expect(currentActor('disabled-admin')).rejects.toThrow(/vô hiệu hóa/i)
    await expect(currentActor('plain-employee')).rejects.toThrow(/Quyền quản lý đã thay đổi/i)
  })
})
