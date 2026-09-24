import { prisma } from '../../config/database.js'

export type LogActionInput = {
  userId?: string
  action: string
  target_table: string
  record_id: string
  old_values?: unknown
  new_values?: unknown
}

export const logAction = (data: LogActionInput) =>
  prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      target_table: data.target_table,
      record_id: data.record_id,
      old_values: data.old_values as any,
      new_values: data.new_values as any,
    },
  })

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