import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import * as service from './biometric.service.js';
import { enrollImagesSchema } from './biometric.dto.js';

export const biometricRouter = Router();
biometricRouter.use(authenticate);

biometricRouter.get(
  ['/:employeeId', '/face/:employeeId'],
  asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId as string;

    // Phân quyền chặt chẽ: ADMIN/MANAGER xem được mọi nhân viên, EMPLOYEE chỉ được xem dữ liệu của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const isSelf =
        req.user.id === employeeId ||
        req.user.employeeId === employeeId ||
        req.user.employee_id === employeeId;
      if (!isSelf) {
        throw AppError.forbidden('Bạn không có quyền xem dữ liệu sinh trắc học của nhân viên khác');
      }
    }

    successResponse(res, await service.getByEmployee(employeeId));
  })
);

biometricRouter.post(
  '/:employeeId/enroll-images',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = enrollImagesSchema.parse(req.body);
    const employeeId = req.params.employeeId as string;
    const result = await service.enrollImages(employeeId, body.images, req.user?.id);
    successResponse(res, result, 'Face enrollment completed', 201);
  })
);

biometricRouter.delete(
  ['/:employeeId', '/face/:employeeId'],
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId as string;
    await service.removeAll(employeeId, req.user?.id);
    successResponse(res, null, 'Biometric data deleted');
  })
);
