import { Router } from 'express'
import { successResponse } from '../../common/response.js'
import { loginSchema, registerSchema } from './auth.dto.js'
import * as service from './auth.service.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    successResponse(res, await service.login(loginSchema.parse(req.body)), 'Logged in')
  } catch (e) {
    next(e)
  }
})

authRouter.post('/register', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    successResponse(res, await service.register(registerSchema.parse(req.body)), 'Registered', 201)
  } catch (e) {
    next(e)
  }
})

