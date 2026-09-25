import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

export type LogActionInput = {
  userId?: string
  action: string
  target_table: string
  record_id: string
  old_values?: unknown
  new_values?: unknown
}

function sanitizeForJson(obj: unknown): Prisma.InputJsonValue {
  if (obj === null || obj === undefined) return Prisma.JsonNull as unknown as Prisma.InputJsonValue
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as Prisma.InputJsonValue
}

export const logAction = async (data: LogActionInput) => {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        target_table: data.target_table,
        record_id: String(data.record_id),
        old_values: sanitizeForJson(data.old_values),
        new_values: sanitizeForJson(data.new_values),
      },
    })
  } catch (err) {
    console.error('[AuditLog] Failed to persist audit log:', err)
    return null
  }
}

export const listLogs = (limit = 100) =>
  prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          username: true,
          roles: { select: { role_name: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: Math.min(limit, 100),
  })