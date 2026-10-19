import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './employee.controller.js';

export const employeeRouter = Router();

employeeRouter.use(authenticate);

employeeRouter.get('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.list));
employeeRouter.get('/:id', asyncHandler(controller.getById));
employeeRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.create));
employeeRouter.put('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.update));
employeeRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.remove));
employeeRouter.post('/:id/reset-password', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.resetPassword));

