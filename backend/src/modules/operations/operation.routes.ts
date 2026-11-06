import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { asyncHandler } from '../../middlewares/asyncHandler.js'
import { successResponse } from '../../common/response.js'
import { listOperations, readOperation, readOperationByKey, retryFailedOperation } from './operation.service.js'
import { authorize } from '../../middlewares/rbac.middleware.js'

export const operationRouter = Router()
operationRouter.use(authenticate)
operationRouter.post('/:id/retry', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  successResponse(res, await retryFailedOperation(z.string().uuid().parse(req.params.id), req.user!.id, z.string().uuid().parse(req.header('Idempotency-Key'))), 'Đã tiếp nhận thử lại các ca lỗi', 202)
}))
operationRouter.get('/by-key/:key', asyncHandler(async (req, res) => {
  successResponse(res, await readOperationByKey(z.string().uuid().parse(req.params.key), req.user!.id))
}))
operationRouter.get('/', asyncHandler(async (req, res) => {
  successResponse(res, await listOperations(req.user!.id, req.query.active === 'true'))
}))
operationRouter.get('/:id', asyncHandler(async (req, res) => {
  successResponse(res, await readOperation(z.string().uuid().parse(req.params.id), req.user!.id))
}))
