import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { prisma } from '../../config/database.js'
import * as service from './shift.service.js'
import { assignShiftSchema } from './shift.dto.js'

export const shiftRouter = Router()
shiftRouter.use(authenticate)

shiftRouter.get('/', async (req, res, next) => {
  try {
    const query = { ...req.query } as Record<string, any>

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được lịch phân ca của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      })
      if (!emp) {
        return successResponse(res, [])
      }
      query.employee_id = emp.id
    }

    successResponse(res, await service.list(query))
  } catch (e) {
    next(e)
  }
})

shiftRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = assignShiftSchema.parse(req.body)

    const empId = (body.employee_id || body.employeeId)!
    const dateStr = (body.date || body.work_date)!

    const result = await service.assignOrUpdate({
      ...body,
      employee_id: empId,
      date: dateStr,
    }, req.user?.id)
    successResponse(res, result, 'Work shift saved', 200)
  } catch (e) {
    next(e)
  }
})