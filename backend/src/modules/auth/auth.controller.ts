import { Router } from 'express'
import { successResponse } from '../../common/response.js'
import { loginSchema, registerSchema } from './auth.dto.js'
import * as service from './auth.service.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { USER_ROLES } from '../../common/constants.js'

export const authRouter = Router()

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    successResponse(res, await service.login(req.body), 'Logged in')
  } catch (e) {
    next(e)
  }
})

authRouter.post(
  '/register',
  authenticate,
  authorize(USER_ROLES.ADMIN),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      successResponse(res, await service.register(req.body), 'Registered', 201)
    } catch (e) {
      next(e)
    }
  },
)

