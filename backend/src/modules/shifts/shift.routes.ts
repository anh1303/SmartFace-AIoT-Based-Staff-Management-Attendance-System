import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './shift.controller.js';

export const shiftRouter = Router();

shiftRouter.use(authenticate);

shiftRouter.get('/', asyncHandler(controller.list));
shiftRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.assignShift));
