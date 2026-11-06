import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/config/env.js', () => ({ env: { BIOMETRIC_ENCRYPTION_KEY: 'service-test-key-at-least-32-characters' } }))
import { enqueueOperation, findOperationByKey, readOperation, readOperationByKey } from '../../src/modules/operations/operation.service.js'
import { payloadHash } from '../../src/modules/operations/operation.contract.js'
import { decryptPayload } from '../../src/modules/operations/operation.crypto.js'

const owner = '11111111-1111-4111-8111-111111111111'
const key = '22222222-2222-4222-8222-222222222222'
const payload = { employeeId: 'employee-a' }
const row = () => ({
  id: '33333333-3333-4333-8333-333333333333', owner_id: owner, idempotency_key: key,
  type: 'biometric.enroll', label: 'Enroll', payload, input_hash: payloadHash(payload),
  status: 'succeeded', revision: 3, total: 1, completed: 1, succeeded: 1, failed: 0, skipped: 0,
  result: { employeeId: 'employee-a' }, error: null, attempts: 1, lease_token: null,
  created_at: new Date('2026-11-06T00:00:00Z'), updated_at: new Date('2026-11-06T00:01:00Z'),
})
const command = () => ({ ownerId: owner, key, type: 'biometric.enroll', label: 'Enroll', payload, secret: { images: ['private-face'] } })

beforeEach(() => { vi.resetAllMocks(); db.$executeRaw.mockResolvedValue(1) })

describe('operation admission and owner isolation', () => {
  it('returns the existing completed operation on replay without restaging secrets or items', async () => {
    db.$queryRaw.mockResolvedValue([row()])
    const operation = await enqueueOperation(db as any, { ...command(), items: [{ key: 'one', payload }] })
    expect(operation).toMatchObject({ jobId: row().id, status: 'succeeded', revision: 3 })
    // The only write is the admission lock; a replay must not insert staged input or work items.
    expect(db.$executeRaw.mock.calls.map(call => call.slice(1))).toEqual([[`operation:${owner}:${key}`]])
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it.each([
    { payload: { employeeId: 'employee-b' } },
    { type: 'employee.email' },
  ])('rejects a reused idempotency key for a different command: %j', async change => {
    db.$queryRaw.mockResolvedValue([row()])
    await expect(enqueueOperation(db as any, { ...command(), ...change })).rejects.toMatchObject({ statusCode: 409 })
    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('stages encrypted input only on first admission and does not expose it in the response', async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockImplementationOnce(async (_query, id) => [{ ...row(), id, status: 'queued', revision: 1 }])
    const operation = await enqueueOperation(db as any, command())
    const [insertedId, ciphertext] = db.$executeRaw.mock.calls[1].slice(1)
    expect(insertedId).toBe(operation.jobId)
    expect(Buffer.isBuffer(ciphertext)).toBe(true)
    expect(decryptPayload(ciphertext, 'service-test-key-at-least-32-characters')).toEqual({ images: ['private-face'] })
    expect(JSON.stringify(operation)).not.toContain('private-face')
    expect(operation).not.toHaveProperty('payload')
  })

  it('scopes both ID and idempotency-key lookups to the requesting owner', async () => {
    const foreignOwner = '44444444-4444-4444-8444-444444444444'
    db.$queryRaw.mockImplementation(async (_query, first, second) => {
      if (first === row().id && second === owner) return [row()]
      if (first === owner && second === key) return [row()]
      return []
    })
    await expect(readOperation(row().id, foreignOwner)).rejects.toMatchObject({ statusCode: 404 })
    await expect(readOperationByKey(key, foreignOwner)).rejects.toMatchObject({ statusCode: 404 })
    await expect(readOperationByKey(key, owner)).resolves.toMatchObject({ jobId: row().id })
    await expect(findOperationByKey(foreignOwner, key, 'biometric.enroll', payload)).resolves.toBeUndefined()
    await expect(findOperationByKey(owner, key, 'biometric.enroll', payload)).resolves.toMatchObject({ id: row().id })
  })
})
