import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './biometric.controller.js';
import { requirePasswordAuth } from '../auth/public.js';

export const biometricRouter = Router();

biometricRouter.use(authenticate);

biometricRouter.get(['/:employeeId', '/face/:employeeId'], asyncHandler(controller.getByEmployee));
biometricRouter.post('/:employeeId/enroll-images', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.enrollImages));
biometricRouter.post('/:employeeId/deactivate', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.deactivate));
biometricRouter.delete('/:employeeId', authorize('ADMIN', 'MANAGER'), requirePasswordAuth, asyncHandler(controller.removeAll));
