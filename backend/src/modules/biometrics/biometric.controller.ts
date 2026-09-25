import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import { AppError } from '../../common/AppError.js'
import * as service from './biometric.service.js'
import { registerBiometricSchema } from './biometric.dto.js'

export const biometricRouter = Router()
biometricRouter.use(authenticate)

biometricRouter.get(['/:employeeId', '/face/:employeeId'], async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string

    // 16. Phân quyền chặt chẽ: ADMIN/MANAGER xem được mọi nhân viên, EMPLOYEE chỉ được xem dữ liệu của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const isSelf = req.user.id === employeeId || req.user.employeeId === employeeId || req.user.employee_id === employeeId
      if (!isSelf) {
        throw new AppError(403, 'Bạn không có quyền xem dữ liệu sinh trắc học của nhân viên khác')
      }
    }

    successResponse(res, await service.getByEmployee(employeeId))
  } catch (e) {
    next(e)
  }
})

biometricRouter.post(['/:employeeId', '/face/:employeeId', '/face/enroll'], authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const body = registerBiometricSchema.parse(req.body)

    const employeeId = (req.params.employeeId || body.employeeId) as string
    if (!employeeId) {
      throw new AppError(400, 'Employee ID is required in URL or request body')
    }

    successResponse(
      res,
      await service.register(
        employeeId,
        body.embedding,
        {
          model_version: body.model_version,
          sample_tag: body.sample_tag,
          quality_score: body.quality_score,
        },
        req.user?.id,
      ),
      'Biometric sample registered',
      201,
    )
  } catch (e) {
    next(e)
  }
})

biometricRouter.delete(['/:employeeId', '/face/:employeeId'], authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId as string
    await service.removeAll(employeeId, req.user?.id)
    successResponse(res, null, 'Biometric data deleted')
  } catch (e) {
    next(e)
  }
})
