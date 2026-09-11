import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import * as service from './employee.service.js'

const createSchema = z.object({
  employee_code: z.string().optional(),
  employee_id: z.string().optional(),
  full_name: z.string().min(1, 'Họ và tên không được để trống'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')).nullable(),
  position: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.number().int().positive().nullable().optional(),
  department: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  base_salary: z.number().nonnegative().max(999999999999, 'Lương cơ bản tối đa 999 tỷ').optional(),
  avatar: z.string().optional().nullable(),
  avatar_url: z.string().optional().nullable(),
})

const updateSchema = createSchema.partial()

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

employeeRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body)
    const empData = {
      ...body,
      employee_code: body.employee_code || body.employee_id,
    }
    successResponse(res, await service.create(empData), 'Employee created', 201)
  } catch (e) {
    next(e)
  }
})

employeeRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    successResponse(
      res,
      await service.update(id, updateSchema.parse(req.body)),
      'Employee updated',
    )
  } catch (e) {
    next(e)
  }
})

employeeRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    await service.remove(id)
    successResponse(res, null, 'Employee deleted')
  } catch (e) {
    next(e)
  }
})
