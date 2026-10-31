import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { asyncHandler } from '../../middlewares/asyncHandler.js'
import { AppError } from '../../common/AppError.js'
import { successResponse } from '../../common/response.js'
import { getEmployeeScope } from '../employees/employee.permission.js'

export const notificationRouter = Router()
notificationRouter.use(authenticate)

async function scope(userId: string): Promise<Prisma.SystemNotificationWhereInput> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } })
  if (!user?.is_active) throw AppError.unauthorized()
  const role = user.roles.role_name.toUpperCase()
  if (role === 'ADMIN') return { user_id: userId, deleted_at: null }
  const employeeScope = await getEmployeeScope({ id: userId, role }, 'read')
  return { user_id: userId, deleted_at: null, employee: { is: employeeScope } }
}

notificationRouter.get('/', asyncHandler(async (req, res) => {
  const where = await scope(req.user!.id)
  const rows = await prisma.systemNotification.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 100 })
  successResponse(res, rows.map(row => ({ id: `server_${row.id}`, title: row.title, message: row.message, type: 'warning', timestamp: row.created_at.toISOString(), read: Boolean(row.read_at) })))
}))

notificationRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (!/^\d{1,18}$/.test(req.params.id)) throw AppError.badRequest('Thông báo không hợp lệ')
  if (!['read', 'delete'].includes(req.body?.action)) throw AppError.badRequest('Thao tác không hợp lệ')
  const where = await scope(req.user!.id)
  const result = await prisma.systemNotification.updateMany({ where: { AND: [where, { id: BigInt(req.params.id) }] }, data: req.body.action === 'read' ? { read_at: new Date() } : { deleted_at: new Date() } })
  if (!result.count) throw AppError.notFound('Không tìm thấy thông báo')
  successResponse(res, { updated: true })
}))

notificationRouter.patch('/', asyncHandler(async (req, res) => {
  if (!['read', 'delete'].includes(req.body?.action)) throw AppError.badRequest('Thao tác không hợp lệ')
  const where = await scope(req.user!.id)
  await prisma.systemNotification.updateMany({ where, data: req.body.action === 'read' ? { read_at: new Date() } : { deleted_at: new Date() } })
  successResponse(res, { updated: true })
}))
