import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }))
const gateway = vi.hoisted(() => ({ announceOperation: vi.fn() }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/operations/operation.gateway.js', () => gateway)
vi.mock('../../src/common/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('../../src/modules/auth/public.js', () => ({ findAuthUserById: vi.fn() }))
import { claimOperation, registerOperationHandler, runOperationTick, startOperationWorker, stopOperationWorker, wakeOperationWorker } from '../../src/modules/operations/operation.worker.js'

const job = () => ({ id: 'job-a', owner_id: 'owner-a', type: 'worker.test', lease_token: 'lease-a', status: 'running' })
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => { vi.resetAllMocks(); db.$executeRaw.mockResolvedValue(1) })
afterEach(() => vi.useRealTimers())

describe('operation worker recovery boundaries', () => {
  it('returns no claimed operation when the database has no eligible work', async () => {
    db.$queryRaw.mockResolvedValue([])
    await expect(claimOperation()).resolves.toBeUndefined()
  })

  it('passes the database-issued lease and attempt state to the handler on recovery', async () => {
    const recovered = { ...job(), lease_token: 'new-lease', attempts: 2 }
    db.$queryRaw.mockResolvedValueOnce([recovered]).mockResolvedValueOnce([{ status: 'succeeded' }])
    const handled: unknown[] = []
    registerOperationHandler('worker.test', async claimed => { handled.push(claimed) })
    await runOperationTick()
    expect(handled).toEqual([recovered])
    expect(gateway.announceOperation).toHaveBeenCalledWith('owner-a', 'job-a')
  })

  it('does not run a second handler while the first tick is still processing', async () => {
    const entered = deferred()
    const release = deferred()
    let executions = 0
    db.$queryRaw.mockResolvedValueOnce([job()]).mockResolvedValueOnce([{ status: 'succeeded' }])
    registerOperationHandler('worker.test', async () => {
      executions++
      entered.resolve()
      await release.promise
    })
    const first = runOperationTick()
    await entered.promise
    try {
      await runOperationTick()
      expect(executions).toBe(1)
      expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    } finally { release.resolve(); await first }
    expect(gateway.announceOperation).toHaveBeenCalledTimes(1)
  })

  it('fences failure writes with the claimed lease and hides internal errors', async () => {
    db.$queryRaw.mockResolvedValueOnce([job()]).mockResolvedValueOnce([{ status: 'running' }])
    registerOperationHandler('worker.test', async () => { throw new Error('private SMTP credential') })
    await runOperationTick()
    const failureValues = db.$executeRaw.mock.calls[1].slice(1)
    expect(failureValues.slice(1)).toEqual(['job-a', 'lease-a'])
    expect(failureValues[0]).not.toContain('private SMTP credential')
    // A job still running under another lease must keep its staged input.
    expect(db.$executeRaw).toHaveBeenCalledTimes(2)
    expect(gateway.announceOperation).toHaveBeenCalledWith('owner-a', 'job-a')
  })

  it('heartbeats the active lease and stops heartbeats after the handler completes', async () => {
    vi.useFakeTimers()
    const entered = deferred()
    const release = deferred()
    db.$queryRaw.mockResolvedValueOnce([job()]).mockResolvedValueOnce([{ status: 'running' }])
    registerOperationHandler('worker.test', async () => { entered.resolve(); await release.promise })
    const tick = runOperationTick()
    await entered.promise
    try {
      await vi.advanceTimersByTimeAsync(20000)
      expect(db.$executeRaw.mock.calls[1].slice(1)).toEqual(['job-a', 'lease-a'])
    } finally { release.resolve(); await tick }
    const writes = db.$executeRaw.mock.calls.length
    await vi.advanceTimersByTimeAsync(40000)
    expect(db.$executeRaw).toHaveBeenCalledTimes(writes)
  })
  it('starts committed work immediately and retries a wake received while busy', async () => {
    vi.useFakeTimers()
    const entered = deferred()
    const release = deferred()
    const second = deferred()
    const handled: string[] = []
    db.$queryRaw.mockResolvedValueOnce([job()]).mockResolvedValueOnce([{ status: 'succeeded' }])
      .mockResolvedValueOnce([{ ...job(), id: 'job-b' }]).mockResolvedValueOnce([{ status: 'succeeded' }])
    registerOperationHandler('worker.test', async claimed => {
      handled.push(claimed.id)
      if (claimed.id === 'job-a') { entered.resolve(); await release.promise } else second.resolve()
    })
    startOperationWorker()
    try {
      wakeOperationWorker()
      await entered.promise
      wakeOperationWorker()
      release.resolve()
      await second.promise
      expect(handled).toEqual(['job-a', 'job-b'])
    } finally { release.resolve(); await stopOperationWorker() }
  })

})
