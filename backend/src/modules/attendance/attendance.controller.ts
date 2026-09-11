import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { AppError } from '../../common/AppError.js'
import * as service from './attendance.service.js'
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js'

export const attendanceRouter = Router()
attendanceRouter.use(authenticate)

attendanceRouter.get('/', async (req, res, next) => {
  try {
    successResponse(res, await service.list(req.query))
  } catch (e) {
    next(e)
  }
})

attendanceRouter.get('/statistics', async (_req, res, next) => {
  try {
    successResponse(res, await service.statistics())
  } catch (e) {
    next(e)
  }
})

attendanceRouter.post(
  '/check-in',
  authorize('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const body = z.object({
        employeeId: z.string().min(1),
        device_info: z.string().optional(),
        method: z.enum(['FACE', 'FINGERPRINT', 'MANUAL']).optional(),
      }).parse(req.body)

      const record = await service.checkIn({
        employeeId: body.employeeId,
        device_info: body.device_info,
        method: body.method,
      })
      emitAttendanceEvent('checked-in', record)
      successResponse(res, record, 'Checked in', 201)
    } catch (e) {
      next(e)
    }
  },
)

attendanceRouter.post('/check-out', async (req, res, next) => {
  try {
    const body = z.object({
      employeeId: z.string().min(1),
      device_info: z.string().optional(),
    }).parse(req.body)

    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== body.employeeId) {
      return next(new AppError(403, 'Forbidden'))
    }

    const record = await service.checkOut(body.employeeId, body.device_info)
    emitAttendanceEvent('checked-out', record)
    successResponse(res, record, 'Checked out')
  } catch (e) {
    next(e)
  }
})
