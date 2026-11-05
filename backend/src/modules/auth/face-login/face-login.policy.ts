import { randomBytes } from 'node:crypto'

type Challenge = { id: string; expiresAt: number; binding: string }

/** One backend process only. Expired/consumed challenges cannot be retried. */
export class ChallengeStore {
  private readonly entries = new Map<string, Challenge>()
  constructor(private readonly now = Date.now, private readonly ttl = 60_000, private readonly maximum = 100) {}
  create(binding: string) {
    for (const [id, entry] of this.entries) if (entry.expiresAt <= this.now()) this.entries.delete(id)
    if (this.entries.size >= this.maximum) throw new Error('Challenge capacity reached')
    const entry: Challenge = { id: randomBytes(16).toString('hex'), expiresAt: this.now() + this.ttl, binding }
    this.entries.set(entry.id, entry)
    return { id: entry.id, expiresAt: entry.expiresAt }
  }
  consume(id: string, binding: string): Challenge | null {
    const entry = this.entries.get(id)
    this.entries.delete(id)
    return entry && entry.expiresAt > this.now() && binding && entry.binding === binding ? entry : null
  }
}

export function faceSessionAllowed(amr: unknown, role: string, enabled: boolean) {
  if (!Array.isArray(amr) || !amr.includes('face')) return true
  return enabled && role.toUpperCase() === 'EMPLOYEE'
}
