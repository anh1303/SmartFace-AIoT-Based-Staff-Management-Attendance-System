import type { Prisma } from '@prisma/client'

/**
 * Acquire multiple PostgreSQL transaction-scoped advisory locks in a single SQL round-trip
 * while strictly preserving the first-occurrence order of keys (critical for deadlock prevention).
 */
export async function acquireAdvisoryLocks(
  tx: Prisma.TransactionClient,
  keys: readonly string[],
): Promise<void> {
  if (typeof (tx as any)?.$executeRaw !== 'function') return
  const orderedKeys: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    orderedKeys.push(key)
  }
  if (orderedKeys.length === 0) return
  if (orderedKeys.length === 1) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderedKeys[0]}))`
    return
  }
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(ordered.k))
    FROM (
      SELECT k FROM unnest(${orderedKeys}::text[]) WITH ORDINALITY AS t(k, ord)
      ORDER BY ord
    ) AS ordered
  `
}
