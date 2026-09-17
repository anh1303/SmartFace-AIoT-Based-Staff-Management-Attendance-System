import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import * as service from './biometric.service.js'

export const biometricRouter = Router()
biometricRouter.use(authenticate)

biometricRouter.get('/:employeeId', async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string
    successResponse(res, await service.getByEmployee(employeeId))
  } catch (e) {
    next(e)
  }
})

biometricRouter.post('/:employeeId', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string
    const body = z.object({
      embedding: z.array(z.number()).min(64).max(1024),
      model_version: z.string().optional(),
      sample_tag: z.string().optional(),
      quality_score: z.number().min(0).max(1).optional(),
    }).parse(req.body)

    successResponse(
      res,
      await service.register(employeeId, body.embedding, {
        model_version: body.model_version,
        sample_tag: body.sample_tag,
        quality_score: body.quality_score,
      }),
      'Biometric sample registered',
      201,
    )
  } catch (e) {
    next(e)
  }
})

biometricRouter.delete('/:employeeId', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string
    await service.removeAll(employeeId)
    successResponse(res, null, 'Biometric data deleted')
  } catch (e) {
    next(e)
  }
})
