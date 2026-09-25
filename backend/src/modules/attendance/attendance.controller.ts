import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { AppError } from '../../common/AppError.js'
import { prisma } from '../../config/database.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import * as service from './attendance.service.js'
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js'
import { checkInSchema, adjustAttendanceSchema, checkOutSchema } from './attendance.dto.js'

export const attendanceRouter = Router()
attendanceRouter.use(authenticate)

attendanceRouter.get('/', async (req, res, next) => {
  try {
    const query = { ...req.query } as Record<string, any>

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được lịch sử điểm danh của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      })
      if (!emp) {
        return successResponse(res, [])
      }
      query.employeeId = emp.id
    }

    successResponse(res, await service.list(query))
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
  ['/check-in', '/checkin'],
  async (req, res, next) => {
    try {
      const body = checkInSchema.parse(req.body)

      // 20. Phân quyền chặt chẽ: EMPLOYEE chỉ được phép chấm công cho chính mình
      if (req.user?.role === 'EMPLOYEE') {
        const emp = await prisma.employee.findFirst({
          where: buildIdOrCodeWhere(body.employeeId),
        })
        if (!emp || emp.user_id !== req.user.id) {
          throw new AppError(403, 'Nhân viên chỉ được phép thực hiện chấm công vào cho chính mình!')
        }
      }

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

attendanceRouter.get('/summaries', async (req, res, next) => {
  try {
    const query = { ...req.query } as Record<string, any>

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được tổng hợp công hàng ngày của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      })
      if (!emp) {
        return successResponse(res, [])
      }
      query.employeeId = emp.id
    }

    successResponse(res, await service.getDailySummaries(query))
  } catch (e) {
    next(e)
  }
})

attendanceRouter.patch(
  '/adjust',
  authorize('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const body = adjustAttendanceSchema.parse(req.body)

      const updated = await service.adjustAttendance(body, req.user?.id)
      successResponse(res, updated, 'Attendance adjusted successfully')
    } catch (e) {
      next(e)
    }
  },
)

attendanceRouter.post(['/check-out', '/checkout'], async (req, res, next) => {
  try {
    const body = checkOutSchema.parse(req.body)

    // 20. Phân quyền chặt chẽ: EMPLOYEE chỉ được phép chấm công ra cho chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(body.employeeId),
      })
      if (!emp || emp.user_id !== req.user.id) {
        throw new AppError(403, 'Nhân viên chỉ được phép thực hiện chấm công ra cho chính mình!')
      }
    }

    const record = await service.checkOut(body.employeeId, body.device_info)
    emitAttendanceEvent('checked-out', record)
    successResponse(res, record, 'Checked out')
  } catch (e) {
    next(e)
  }
})

attendanceRouter.get('/locks', async (_req, res, next) => {
  try {
    successResponse(res, await service.getLocks())
  } catch (e) {
    next(e)
  }
})

attendanceRouter.post('/locks/lock', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { date } = req.body
    if (!date) throw new AppError(400, 'Date is required')
    successResponse(res, await service.toggleLock(date, true, req.user?.id), 'Date locked')
  } catch (e) {
    next(e)
  }
})

attendanceRouter.post('/locks/unlock', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { date } = req.body
    if (!date) throw new AppError(400, 'Date is required')
    successResponse(res, await service.toggleLock(date, false, req.user?.id), 'Date unlocked')
  } catch (e) {
    next(e)
  }
})

