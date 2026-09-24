import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
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

shiftRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = z.object({
      employee_id: z.string().min(1),
      date: z.string().min(1),
      work_day: z.string().optional(),
      shift_type: z.string().min(1),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      note: z.string().optional(),
    }).parse(req.body)

    const result = await service.assignOrUpdate(body)
    successResponse(res, result, 'Work shift saved', 200)
  } catch (e) {
    next(e)
  }
})