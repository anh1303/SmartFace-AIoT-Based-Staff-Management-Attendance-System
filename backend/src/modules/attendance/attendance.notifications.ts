import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { asyncHandler } from '../../middlewares/asyncHandler.js'
import { AppError } from '../../common/AppError.js'
import { successResponse } from '../../common/response.js'
import { listNotifications, updateNotifications } from './attendance.notifications.service.js'

export const notificationRouter = Router()
notificationRouter.use(authenticate)

notificationRouter.get('/', asyncHandler(async (req, res) => {
  successResponse(res, await listNotifications(req.user!.id))
}))

notificationRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (!/^\d{1,18}$/.test(req.params.id)) throw AppError.badRequest('Thông báo không hợp lệ')
  if (!['read', 'delete'].includes(req.body?.action)) throw AppError.badRequest('Thao tác không hợp lệ')
  await updateNotifications(req.user!.id, req.body.action, BigInt(req.params.id))
  successResponse(res, { updated: true })
}))

notificationRouter.patch('/', asyncHandler(async (req, res) => {
  if (!['read', 'delete'].includes(req.body?.action)) throw AppError.badRequest('Thao tác không hợp lệ')
  await updateNotifications(req.user!.id, req.body.action)
  successResponse(res, { updated: true })
}))
