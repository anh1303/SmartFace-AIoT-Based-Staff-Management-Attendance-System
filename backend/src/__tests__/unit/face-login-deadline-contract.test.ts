import { describe, expect, it } from 'vitest'
import {
  ATTEMPT_TTL_MS,
  AttemptError,
  AttemptStore,
  VERIFIED_FRESH_MS,
  digestFrame,
} from '../../modules/auth/face-login/face-login.attempts.js'

describe('Face login deadline & freshness contract (Mục 7.2)', () => {
  it('keeps baseline TTL=15000ms and freshness=5000ms and rejects frame commit after deadline', () => {
    expect(ATTEMPT_TTL_MS).toBe(15_000)
    expect(VERIFIED_FRESH_MS).toBe(5_000)

    let now = 1_000_000
    const store = new AttemptStore(() => now)
    const attempt = store.create('binding-1', 1)
    const digest = digestFrame('frame-1')

    // Start frame just before deadline
    now += 14_500
    const reserved = store.startFrame(attempt, 1, digest)
    expect('op' in reserved).toBe(true)
    const op = 'op' in reserved ? reserved.op : ''

    // Simulate slow DB match finishing right AT/AFTER the 15s attempt deadline
    now += 600 // total elapsed = 15_100ms > ATTEMPT_TTL_MS
    expect(() =>
      store.finishFrame(attempt, op, 1, digest, { employeeId: 'emp-1' }, 'ok'),
    ).toThrow(AttemptError)
    expect(attempt.state).toBe('EXPIRED')
    expect(attempt.verifiedAt).toBeNull()
  })

  it('rejects completion when VERIFIED_FRESH_MS (5000ms) expires during eligibility lookup', () => {
    let now = 2_000_000
    const store = new AttemptStore(() => now)
    const attempt = store.create('binding-2', 1)
    const digest = digestFrame('frame-ok')

    const reserved = store.startFrame(attempt, 1, digest)
    const op = 'op' in reserved ? reserved.op : ''

    // Frame verifies at t=+2000ms (attempt deadline still +13000ms away)
    now += 2_000
    const result = store.finishFrame(attempt, op, 1, digest, { employeeId: 'emp-1' }, 'ok')
    expect(result.state).toBe('verified')
    expect(attempt.state).toBe('VERIFIED')

    // Eligibility lookup stalls past VERIFIED_FRESH_MS (5000ms) while attempt TTL itself hasn't expired
    now += VERIFIED_FRESH_MS + 1
    expect(() => store.reserveCompletion(attempt)).toThrow(AttemptError)
    expect(attempt.state).toBe('EXPIRED')
  })

  it('fences stale in-flight frame when attempt is cancelled or replaced by another login attempt', () => {
    let now = 3_000_000
    const store = new AttemptStore(() => now)
    const attempt = store.create('binding-3', 1)
    const digest = digestFrame('frame-inflight')

    const reserved = store.startFrame(attempt, 1, digest)
    const op = 'op' in reserved ? reserved.op : ''

    // Cancel while frame/DB is in-flight
    store.cancel(attempt)
    expect(attempt.state).toBe('CANCELLED')

    // Late finishFrame must fail and never emit a verified state
    expect(() =>
      store.finishFrame(attempt, op, 1, digest, { employeeId: 'emp-1' }, 'ok'),
    ).toThrow(AttemptError)
    expect(attempt.verifiedAt).toBeNull()
  })
})
