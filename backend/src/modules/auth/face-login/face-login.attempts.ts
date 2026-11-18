import { createHash, randomBytes } from 'node:crypto'

/**
 * Streaming face-login attempt lifecycle (single Node process).
 *
 * READY -> PROCESSING -> READY | VERIFIED
 * VERIFIED -> COMPLETING -> COMPLETED
 * READY | PROCESSING | VERIFIED -> CANCELLED | EXPIRED | FAILED
 * Terminal states never reopen. All transitions are synchronous; callers must
 * re-check guards after every await.
 */
export type AttemptState = 'READY' | 'PROCESSING' | 'VERIFIED' | 'COMPLETING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED'
export type FrameResult = { seq: number; state: 'pending' | 'verified'; nextSeq: number; guidance: string }
export type Completion = { user: unknown; accessToken: string }

export type Attempt = {
  id: string; bindingHash: string; epoch: number; createdAt: number; deadline: number; state: AttemptState
  nextSeq: number; operation: string | null; frames: number; frameTimes: number[]; requiredCount: number
  candidate: string | null; count: number; verifiedAt: number | null; bootId: string | null
  last: { seq: number; digest: string; result: FrameResult } | null
  completion: (Completion & { expiresAt: number }) | null
}

export const ATTEMPT_TTL_MS = 15_000
export const VERIFIED_FRESH_MS = 5_000
export const COMPLETION_RECOVERY_MS = 30_000
export const MAX_ATTEMPT_FRAMES = 75
export const MAX_FRAMES_PER_SECOND = 5
const ACTIVE: AttemptState[] = ['READY', 'PROCESSING', 'VERIFIED', 'COMPLETING']

export const hashBinding = (binding: string) => createHash('sha256').update(binding).digest('hex')
export const digestFrame = (frame: string) => createHash('sha256').update(frame).digest('hex')

export class AttemptStore {
  private readonly items = new Map<string, Attempt>()
  private epoch = 0
  constructor(
    private readonly now = Date.now,
    private readonly maximum = 20,
    private readonly maxPerSecond = MAX_FRAMES_PER_SECOND,
  ) {}

  sweep() {
    const now = this.now()
    for (const [id, a] of this.items) {
      if (ACTIVE.includes(a.state) && a.state !== 'COMPLETING' && a.deadline <= now) a.state = 'EXPIRED'
      const keepUntil = a.completion ? a.completion.expiresAt : a.deadline + 5_000
      if (!ACTIVE.includes(a.state) && keepUntil <= now) this.items.delete(id)
    }
  }

  activeCount() { return [...this.items.values()].filter(a => ACTIVE.includes(a.state)).length }

  /** Creates an attempt; excess active attempts for the same browser binding or global cap are rejected. */
  create(binding: string, requiredCount: number): Attempt {
    this.sweep()
    const bindingHash = hashBinding(binding)
    for (const a of this.items.values()) {
      if (a.bindingHash === bindingHash && ACTIVE.includes(a.state)) {
        throw new AttemptError(429, 'active_attempt')
      }
    }
    if (this.activeCount() >= this.maximum) throw new AttemptError(429, 'capacity')
    const now = this.now()
    const attempt: Attempt = {
      id: randomBytes(16).toString('hex'), bindingHash, epoch: ++this.epoch, createdAt: now, deadline: now + ATTEMPT_TTL_MS,
      state: 'READY', nextSeq: 1, operation: null, frames: 0, frameTimes: [], requiredCount, candidate: null, count: 0,
      verifiedAt: null, bootId: null, last: null, completion: null,
    }
    this.items.set(attempt.id, attempt)
    return attempt
  }

  /** Returns the attempt only for its own browser. Never mutates another browser's attempt. */
  get(id: string, binding: string | undefined): Attempt {
    this.sweep()
    const a = this.items.get(id)
    if (!a || !binding || a.bindingHash !== hashBinding(binding)) throw new AttemptError(404, 'missing')
    return a
  }

  /** Reserve an attempt for one frame. Returns a cached result for an exact duplicate. */
  startFrame(a: Attempt, seq: number, digest: string): { op: string } | { cached: FrameResult } {
    const now = this.now()
    if (ACTIVE.includes(a.state) && a.state !== 'COMPLETING' && a.deadline <= now) {
      a.state = 'EXPIRED'
    }
    if (a.state === 'EXPIRED' || a.state === 'CANCELLED') throw new AttemptError(410, 'gone')
    if (a.state === 'FAILED') throw new AttemptError(410, 'gone')
    if (a.state === 'PROCESSING' || a.state === 'COMPLETING' || a.state === 'COMPLETED') {
      throw new AttemptError(409, 'conflict')
    }
    if ((a.state === 'READY' || a.state === 'VERIFIED') && a.last && a.last.seq === seq) {
      if (a.last.digest === digest) return { cached: a.last.result }
      throw new AttemptError(409, 'conflict')
    }
    if (a.state !== 'READY' || seq !== a.nextSeq) throw new AttemptError(409, 'conflict')
    if (a.frames >= MAX_ATTEMPT_FRAMES) { a.state = 'FAILED'; throw new AttemptError(410, 'exhausted') }
    a.frameTimes = a.frameTimes.filter(t => t > now - 1000)
    if (a.frameTimes.length >= this.maxPerSecond) throw new AttemptError(429, 'frame_rate')
    a.state = 'PROCESSING'
    a.operation = randomBytes(8).toString('hex')
    return { op: a.operation }
  }

  isCurrent(a: Attempt, op: string) {
    if (a.state === 'PROCESSING' && a.deadline <= this.now()) a.state = 'EXPIRED'
    return a.state === 'PROCESSING' && a.operation === op
  }

  /** Busy inference: release without consuming the sequence. */
  releaseFrame(a: Attempt, op: string) {
    if (this.isCurrent(a, op)) { a.state = 'READY'; a.operation = null }
  }

  fail(a: Attempt) { if (a.state === 'READY' || a.state === 'PROCESSING' || a.state === 'VERIFIED') a.state = 'FAILED' }

  expire(a: Attempt) { if (a.state === 'READY' || a.state === 'PROCESSING' || a.state === 'VERIFIED') a.state = 'EXPIRED' }

  /** Records identity evidence for one accepted frame. `employeeId` null means reset. */
  finishFrame(a: Attempt, op: string, seq: number, digest: string, evidence: { employeeId: string | null; pending?: boolean }, guidance: string): FrameResult {
    if (!this.isCurrent(a, op)) throw new AttemptError(410, 'gone')
    if (evidence.employeeId) {
      a.count = a.candidate === evidence.employeeId ? a.count + 1 : 1
      a.candidate = evidence.employeeId
    } else if (!evidence.pending) {
      a.count = 0; a.candidate = null
    }
    const now = this.now()
    a.frames += 1
    a.frameTimes.push(now)
    a.nextSeq = seq + 1
    a.operation = null
    const verified = a.candidate !== null && a.count >= a.requiredCount
    a.state = verified ? 'VERIFIED' : 'READY'
    if (verified) a.verifiedAt = now
    const result: FrameResult = { seq, state: verified ? 'verified' : 'pending', nextSeq: a.nextSeq, guidance }
    a.last = { seq, digest, result }
    return result
  }

  cancel(a: Attempt) {
    if (a.state === 'COMPLETING' || a.state === 'COMPLETED') throw new AttemptError(409, 'committed')
    if (ACTIVE.includes(a.state)) a.state = 'CANCELLED'
  }

  /** Guard before the awaited account check. */
  assertCompletable(a: Attempt) {
    const now = this.now()
    if (a.state !== 'VERIFIED') throw new AttemptError(a.state === 'COMPLETING' ? 409 : 410, 'not_verified')
    if (a.deadline <= now || a.verifiedAt === null || now - a.verifiedAt > VERIFIED_FRESH_MS) {
      a.state = 'EXPIRED'
      throw new AttemptError(410, 'stale')
    }
    return a.candidate!
  }

  /** Point of no cancellation: transitions VERIFIED -> COMPLETING after awaited eligibility checks. */
  reserveCompletion(a: Attempt) {
    this.assertCompletable(a)
    a.state = 'COMPLETING'
  }

  /** Transitions COMPLETING -> COMPLETED and caches the prepared token for bounded retry recovery. */
  finishCompletion(a: Attempt, completion: Completion) {
    if (a.state !== 'COMPLETING') throw new AttemptError(409, 'not_completing')
    a.completion = { ...completion, expiresAt: this.now() + COMPLETION_RECOVERY_MS }
    a.state = 'COMPLETED'
    return completion
  }

  /** Synchronous convenience combining reserveCompletion + finishCompletion (re-uses cached token if already completed). */
  commit(a: Attempt, completion: Completion) {
    const concurrent = this.recover(a)
    if (concurrent) return concurrent
    this.reserveCompletion(a)
    return this.finishCompletion(a, completion)
  }

  /** Lost-response recovery: same token, never a newly minted one. */
  recover(a: Attempt): Completion | null {
    if (a.state !== 'COMPLETED' || !a.completion || a.completion.expiresAt <= this.now()) return null
    return { user: a.completion.user, accessToken: a.completion.accessToken }
  }

  /** Invalidates all active attempts and completed recovery caches for a browser binding. */
  invalidateBinding(binding: string): string[] {
    if (!binding) return []
    const bindingHash = hashBinding(binding)
    const cancelledIds: string[] = []
    for (const [id, a] of this.items) {
      if (a.bindingHash !== bindingHash) continue
      if (ACTIVE.includes(a.state)) {
        a.state = 'CANCELLED'
        cancelledIds.push(id)
      }
      a.operation = null
      a.candidate = null
      a.count = 0
      a.verifiedAt = null
      a.last = null
      a.completion = null
      this.items.delete(id)
    }
    return cancelledIds
  }

  /** Drops only COMPLETED recovery entries for a browser binding without cancelling active attempts. */
  dropCompletedRecovery(binding: string): void {
    if (!binding) return
    const bindingHash = hashBinding(binding)
    for (const [id, a] of this.items) {
      if (a.bindingHash !== bindingHash) continue
      if (a.state === 'COMPLETED' || a.completion !== null) {
        a.completion = null
        if (a.state === 'COMPLETED') {
          this.items.delete(id)
        }
      }
    }
  }
}

export class AttemptError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}
