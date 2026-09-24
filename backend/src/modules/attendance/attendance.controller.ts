import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { successResponse } from '../../common/response.js'
import { AppError } from '../../common/AppError.js'
import { USER_ROLES } from '../../common/constants.js'
import { checkInSchema, adjustAttendanceSchema, checkOutSchema } from './attendance.dto.js'
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
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(checkInSchema),
  async (req, res, next) => {
    try {
      const record = await service.checkIn({
        employeeId: req.body.employeeId,
        device_info: req.body.device_info,
        method: req.body.method,
      })
      emitAttendanceEvent('checked-in', record)
      successResponse(res, record, 'Checked in', 201)
    } catch (e) {
      next(e)
    }
  },
)

attendanceRouter.get('/summaries', async (req, res, next) => {
  try {
    successResponse(res, await service.getDailySummaries(req.query))
  } catch (e) {
    next(e)
  }
})

attendanceRouter.patch(
  '/adjust',
  authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(adjustAttendanceSchema),
  async (req, res, next) => {
    try {
      const updated = await service.adjustAttendance(req.body)
      successResponse(res, updated, 'Attendance adjusted successfully')
    } catch (e) {
      next(e)
    }
  },
)

attendanceRouter.post('/check-out', validate(checkOutSchema), async (req, res, next) => {
  try {
    if (req.user?.role === USER_ROLES.EMPLOYEE && req.user.employeeId !== req.body.employeeId) {
      return next(new AppError(403, 'Forbidden'))
    }

    const record = await service.checkOut(req.body.employeeId, req.body.device_info)
    emitAttendanceEvent('checked-out', record)
    successResponse(res, record, 'Checked out')
  } catch (e) {
    next(e)
  }
})
