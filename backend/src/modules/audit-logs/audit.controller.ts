import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { listLogs } from './audit.service.js'

export const auditRouter = Router()
auditRouter.use(authenticate)

// Audit logs — Chỉ ADMIN mới có quyền xem kiểm toán hệ thống
auditRouter.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100
    successResponse(res, await listLogs(limit))
  } catch (e) {
    next(e)
  }
})