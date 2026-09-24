import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { successResponse } from '../../common/response.js'
import { USER_ROLES } from '../../common/constants.js'
import { assignShiftSchema } from './shift.dto.js'
import * as service from './shift.service.js'

export const shiftRouter = Router()
shiftRouter.use(authenticate)

shiftRouter.get('/', async (req, res, next) => {
  try {
    successResponse(res, await service.list(req.query))
  } catch (e) {
    next(e)
  }
})

shiftRouter.post(
  '/',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(assignShiftSchema),
  async (req, res, next) => {
    try {
      const result = await service.assignOrUpdate(req.body)
      successResponse(res, result, 'Work shift saved', 200)
    } catch (e) {
      next(e)
    }
  },
)
