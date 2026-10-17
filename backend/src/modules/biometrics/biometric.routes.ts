import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './biometric.controller.js';

export const biometricRouter = Router();

biometricRouter.use(authenticate);

biometricRouter.get(['/:employeeId', '/face/:employeeId'], asyncHandler(controller.getByEmployee));
biometricRouter.post('/:employeeId/enroll-images', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.enrollImages));
biometricRouter.post('/:employeeId/deactivate', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.deactivate));
biometricRouter.delete('/:employeeId', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.removeAll));
