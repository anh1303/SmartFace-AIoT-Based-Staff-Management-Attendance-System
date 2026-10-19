import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './department.controller.js';

export const departmentRouter = Router();
departmentRouter.use(authenticate);

departmentRouter.get('/', asyncHandler(controller.listDepartments));
departmentRouter.post('/', authorize('ADMIN'), asyncHandler(controller.createDepartment));
departmentRouter.put('/:id', authorize('ADMIN'), asyncHandler(controller.updateDepartment));
departmentRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.deleteDepartment));
