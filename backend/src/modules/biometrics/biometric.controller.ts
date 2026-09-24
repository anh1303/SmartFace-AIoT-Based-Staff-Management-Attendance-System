import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { successResponse } from '../../common/response.js'
import { USER_ROLES } from '../../common/constants.js'
import { registerBiometricSchema } from './biometric.dto.js'
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

biometricRouter.post(
  '/:employeeId',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(registerBiometricSchema),
  async (req, res, next) => {
    try {
      const employeeId = req.params.employeeId as string
      successResponse(
        res,
        await service.register(employeeId, req.body.embedding, {
          model_version: req.body.model_version,
          sample_tag: req.body.sample_tag,
          quality_score: req.body.quality_score,
        }),
        'Biometric sample registered',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

biometricRouter.delete('/:employeeId', authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER), async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string
    await service.removeAll(employeeId)
    successResponse(res, null, 'Biometric data deleted')
  } catch (e) {
    next(e)
  }
})
