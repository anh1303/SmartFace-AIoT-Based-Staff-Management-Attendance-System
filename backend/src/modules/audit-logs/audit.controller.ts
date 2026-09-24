import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { listLogs } from './audit.service.js'

export const auditRouter = Router()
auditRouter.use(authenticate)

// Audit logs — ADMIN hoặc MANAGER mới được xem
auditRouter.get('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100
    successResponse(res, await listLogs(limit))
  } catch (e) {
    next(e)
  }
})