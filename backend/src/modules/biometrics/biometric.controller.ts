import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import * as service from './biometric.service.js';
import { enrollImagesSchema } from './biometric.dto.js';

import { assertCanAccessEmployeeDetail } from '../../common/permission.helper.js';

import { prisma } from '../../config/database.js';
import { buildIdOrCodeWhere } from '../../common/utils.js';
import { isEmployeeManager } from '../../common/permission.helper.js';

export const biometricRouter = Router();
biometricRouter.use(authenticate);

biometricRouter.get(
  ['/:employeeId', '/face/:employeeId'],
  asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId as string;
    await assertCanAccessEmployeeDetail(
      req.user,
      employeeId,
      'Quản lý không có quyền xem dữ liệu sinh trắc học của quản lý khác'
    );
    successResponse(res, await service.getByEmployee(employeeId));
  })
);

biometricRouter.post(
  '/:employeeId/enroll-images',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId as string;

    const targetEmp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(employeeId),
      include: {
        department: true,
        users: { select: { id: true, roles: { select: { role_name: true } } } },
      },
    });
    if (!targetEmp) throw AppError.notFound('Không tìm thấy nhân viên');

    // Chốt chặn Requirement 2: Không ai được tự đăng ký ảnh khuôn mặt sinh trắc học của chính mình
    if (req.user?.role !== 'ADMIN') {
      if (targetEmp.user_id === req.user?.id) {
        throw AppError.forbidden(
          'Không ai được tự đăng ký hoặc sửa dữ liệu khuôn mặt của chính mình. Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!'
        );
      }
      if (req.user?.role === 'MANAGER' && isEmployeeManager(targetEmp)) {
        throw AppError.forbidden('Quản lý không có quyền đăng ký sinh trắc học cho quản lý khác!');
      }
    }

    const body = enrollImagesSchema.parse(req.body);
    const result = await service.enrollImages(employeeId, body.images, req.user?.id);
    successResponse(res, result, 'Face enrollment completed', 201);
  })
);

biometricRouter.delete(
  ['/:employeeId', '/face/:employeeId'],
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const employeeId = req.params.employeeId as string;

    const targetEmp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(employeeId),
      include: {
        department: true,
        users: { select: { id: true, roles: { select: { role_name: true } } } },
      },
    });
    if (!targetEmp) throw AppError.notFound('Không tìm thấy nhân viên');

    // Chốt chặn Requirement 2: Không ai được tự xóa sinh trắc học của chính mình
    if (req.user?.role !== 'ADMIN') {
      if (targetEmp.user_id === req.user?.id) {
        throw AppError.forbidden(
          'Không ai được tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!'
        );
      }
      if (req.user?.role === 'MANAGER' && isEmployeeManager(targetEmp)) {
        throw AppError.forbidden('Quản lý không có quyền xóa dữ liệu sinh trắc học của quản lý khác!');
      }
    }

    await service.removeAll(employeeId, req.user?.id);
    successResponse(res, null, 'Biometric data deleted');
  })
);
