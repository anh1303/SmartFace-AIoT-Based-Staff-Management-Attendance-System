import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../../config/database.js'

export async function claimAlert(kind: 'spoof' | 'unknown', deviceId: string, eventId: string, db: PrismaClient = prisma): Promise<boolean> {
  const key = createHash('sha256').update(JSON.stringify([kind, deviceId, eventId])).digest('hex')
  const rows = await db.$queryRaw<Array<{ event_key: string }>>`
    INSERT INTO webhook_alert_dedup (event_key, kind, expires_at)
    VALUES (${key}, ${kind}, now() + interval '24 hours')
    ON CONFLICT (event_key) DO UPDATE SET expires_at = EXCLUDED.expires_at
    WHERE webhook_alert_dedup.expires_at <= now()
    RETURNING event_key`
  return rows.length === 1
}
