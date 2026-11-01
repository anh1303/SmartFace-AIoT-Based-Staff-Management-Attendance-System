import { PrismaClient } from '@prisma/client'
import { describe, it, expect } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)

;(enabled ? describe : describe.skip)('persistent alert deduplication', () => {
  it('deduplicates concurrent processes and restarts for 24 hours', async () => {
    const { claimAlert } = await import('../../src/modules/attendance/attendance.alert-dedup.js')
    const a = new PrismaClient(), b = new PrismaClient()
    try {
      const results = await Promise.all([claimAlert('spoof', 'gate', 'event-123', a), claimAlert('spoof', 'gate', 'event-123', b)])
      expect(results.filter(Boolean)).toHaveLength(1)
      await a.$disconnect()
      expect(await claimAlert('spoof', 'gate', 'event-123', b)).toBe(false)
      expect(await claimAlert('unknown', 'gate', 'event-123', b)).toBe(true)
      await b.$executeRaw`UPDATE webhook_alert_dedup SET expires_at = now() - interval '1 second' WHERE kind = 'spoof'`
      expect(await claimAlert('spoof', 'gate', 'event-123', b)).toBe(true)
    } finally { await a.$disconnect(); await b.$disconnect() }
  })
})
