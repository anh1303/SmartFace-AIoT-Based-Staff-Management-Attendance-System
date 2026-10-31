import type { PrismaClient } from '@prisma/client'

// Explicit test history; production must import only verified effective months.
export async function ensureTestPayrollPolicy(db: PrismaClient) {
  return db.bonusPenalty.upsert({ where: { effective_period: '2000-01' }, update: {},
    create: { effective_period: '2000-01', overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2, description: 'Synthetic test policy' } })
}
