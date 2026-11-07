import { fingerprintManagementRouter } from './fingerprint.routes.js';
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './biometric.controller.js';
import { requirePasswordAuth } from '../auth/public.js';
import { z } from 'zod';
import { enrollImagesSchema } from './biometric.dto.js';
import { submitEnrollment } from './biometric.jobs.js';
import { successResponse } from '../../common/response.js';

export const biometricRouter = Router();

biometricRouter.use(fingerprintManagementRouter);
biometricRouter.use(authenticate);
biometricRouter.post('/:employeeId/enroll-jobs', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(async (req, res) => {
  const key = z.string().uuid().parse(req.header('Idempotency-Key'));
  const { images } = enrollImagesSchema.parse(req.body);
  successResponse(res, await submitEnrollment(req.params.employeeId as string, images, req.user!, key), 'Đã tiếp nhận ảnh, đang xử lý nền', 202);
}));

biometricRouter.get(['/:employeeId', '/face/:employeeId'], asyncHandler(controller.getByEmployee));
biometricRouter.post('/:employeeId/enroll-images', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.enrollImages));
biometricRouter.post('/:employeeId/deactivate', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.deactivate));
biometricRouter.delete('/:employeeId', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.removeAll));
