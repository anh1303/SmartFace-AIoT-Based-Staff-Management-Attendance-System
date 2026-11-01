import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { getEmployeeScope } from '../employees/public.js'
import { findAuthUserById } from '../auth/public.js'

async function scope(userId: string): Promise<Prisma.SystemNotificationWhereInput> {
  const user = await findAuthUserById(userId, { includeRoles: true })
  if (!user?.is_active) throw AppError.unauthorized()
  const role = user.roles.role_name.toUpperCase()
  if (role === 'ADMIN') return { user_id: userId, deleted_at: null }
  const employeeScope = await getEmployeeScope({ id: userId, role }, 'read')
  return { user_id: userId, deleted_at: null, employee: { is: employeeScope } }
}

export async function listNotifications(userId: string) {
  const where = await scope(userId)
  const rows = await prisma.systemNotification.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 100 })
  return rows.map(row => ({ id: `server_${row.id}`, title: row.title, message: row.message, type: 'warning', timestamp: row.created_at.toISOString(), read: Boolean(row.read_at) }))
}

export async function updateNotifications(userId: string, action: 'read' | 'delete', id?: bigint) {
  const where = await scope(userId)
  const result = await prisma.systemNotification.updateMany({ where: id === undefined ? where : { AND: [where, { id }] }, data: action === 'read' ? { read_at: new Date() } : { deleted_at: new Date() } })
  if (id !== undefined && !result.count) throw AppError.notFound('Kh?ng t?m th?y th?ng b?o')
}
