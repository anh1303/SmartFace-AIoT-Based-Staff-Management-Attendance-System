import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { successResponse } from '../../common/response.js'
import { USER_ROLES } from '../../common/constants.js'
import { createEmployeeSchema, updateEmployeeSchema } from './employee.dto.js'
import * as service from './employee.service.js'

export const employeeRouter = Router()
employeeRouter.use(authenticate)

employeeRouter.get('/', async (req, res, next) => {
  try {
    successResponse(res, await service.list(req.query))
  } catch (e) {
    next(e)
  }
})

employeeRouter.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string
    successResponse(res, await service.get(id))
  } catch (e) {
    next(e)
  }
})

employeeRouter.post(
  '/',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(createEmployeeSchema),
  async (req, res, next) => {
    try {
      const empData = {
        ...req.body,
        employee_code: req.body.employee_code || req.body.employee_id,
      }
      successResponse(res, await service.create(empData), 'Employee created', 201)
    } catch (e) {
      next(e)
    }
  },
)

employeeRouter.put(
  '/:id',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(updateEmployeeSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id as string
      successResponse(res, await service.update(id, req.body), 'Employee updated')
    } catch (e) {
      next(e)
    }
  },
)

employeeRouter.delete('/:id', authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER), async (req, res, next) => {
  try {
    const id = req.params.id as string
    await service.remove(id)
    successResponse(res, null, 'Employee deleted')
  } catch (e) {
    next(e)
  }
})
