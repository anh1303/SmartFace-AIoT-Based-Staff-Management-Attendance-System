import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
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

payrollRouter.put('/bonus-penalty', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = z.object({
      overtime_rate: z.number().optional(),
      late_early_penalty: z.number().optional(),
      description: z.string().optional(),
    }).parse(req.body)
    successResponse(res, await service.updateBonusPenalty(body), 'Cập nhật quy định thưởng/phạt thành công')
  } catch (e) {
    next(e)
  }
})

payrollRouter.get('/', async (req, res, next) => {
  try {
    const period = typeof req.query.payroll_period === 'string' ? req.query.payroll_period : undefined
    successResponse(res, await service.list(period))
  } catch (e) {
    next(e)
  }
})

payrollRouter.post('/generate', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = z.object({
      payroll_period: z.string().regex(/^\d{4}-\d{2}$/, 'Format phải là YYYY-MM'),
      employeeId: z.string().optional(),
    }).parse(req.body)
    successResponse(res, await service.generate(body.payroll_period, body.employeeId), 'Payroll generated', 201)
  } catch (e) {
    next(e)
  }
})

payrollRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const updates = z.object({
      hourly_rate: z.number().optional(),
      allowance: z.number().optional(),
      total_overtime: z.number().optional(),
      total_late_early: z.number().optional(),
      net_salary: z.number().optional(),
      status: z.enum(['PENDING', 'FINALIZED']).optional(),
    }).parse(req.body)
    successResponse(res, await service.updateItem(id, updates), 'Payroll updated')
  } catch (e) {
    next(e)
  }
})

payrollRouter.post('/period/:period/finalize', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const period = req.params.period as string
    successResponse(res, await service.finalizePeriod(period), 'Payroll period finalized')
  } catch (e) {
    next(e)
  }
})

payrollRouter.post('/period/:period/unlock', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const period = req.params.period as string
    successResponse(res, await service.unlockPeriod(period), 'Payroll period unlocked')
  } catch (e) {
    next(e)
  }
})
