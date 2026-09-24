import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { successResponse } from '../../common/response.js'
import { USER_ROLES } from '../../common/constants.js'
import { updateBonusPenaltySchema, generatePayrollSchema, updatePayrollSchema } from './payroll.dto.js'
import * as service from './payroll.service.js'

export const payrollRouter = Router()
payrollRouter.use(authenticate)

payrollRouter.get('/bonus-penalty', async (req, res, next) => {
  try {
    successResponse(res, await service.getBonusPenalty())
  } catch (e) {
    next(e)
  }
})

payrollRouter.put(
  '/bonus-penalty',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(updateBonusPenaltySchema),
  async (req, res, next) => {
    try {
      successResponse(res, await service.updateBonusPenalty(req.body), 'Cập nhật quy định thưởng/phạt thành công')
    } catch (e) {
      next(e)
    }
  },
)

payrollRouter.get('/', async (req, res, next) => {
  try {
    const period = typeof req.query.payroll_period === 'string' ? req.query.payroll_period : undefined
    successResponse(res, await service.list(period))
  } catch (e) {
    next(e)
  }
})

payrollRouter.post(
  '/generate',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(generatePayrollSchema),
  async (req, res, next) => {
    try {
      successResponse(res, await service.generate(req.body.payroll_period, req.body.employeeId), 'Payroll generated', 201)
    } catch (e) {
      next(e)
    }
  },
)

payrollRouter.put(
  '/:id',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(updatePayrollSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id as string
      successResponse(res, await service.updateItem(id, req.body), 'Payroll updated')
    } catch (e) {
      next(e)
    }
  },
)

payrollRouter.post('/period/:period/finalize', authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER), async (req, res, next) => {
  try {
    const period = req.params.period as string
    successResponse(res, await service.finalizePeriod(period), 'Payroll period finalized')
  } catch (e) {
    next(e)
  }
})

payrollRouter.post('/period/:period/unlock', authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER), async (req, res, next) => {
  try {
    const period = req.params.period as string
    successResponse(res, await service.unlockPeriod(period), 'Payroll period unlocked')
  } catch (e) {
    next(e)
  }
})
