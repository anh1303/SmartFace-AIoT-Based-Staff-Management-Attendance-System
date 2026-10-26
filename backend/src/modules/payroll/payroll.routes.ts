import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './payroll.controller.js';

export const payrollRouter = Router();

payrollRouter.use(authenticate);

payrollRouter.get('/bonus-penalty', asyncHandler(controller.getBonusPenalty));
payrollRouter.put('/bonus-penalty', authorize('ADMIN'), asyncHandler(controller.updateBonusPenalty));
payrollRouter.get('/adjustments', asyncHandler(controller.listAdjustments));
payrollRouter.patch('/adjustments/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.reviewAdjustment));
payrollRouter.get('/', asyncHandler(controller.list));
payrollRouter.post('/generate', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.generate));
payrollRouter.put('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.updateItem));
payrollRouter.post('/period/:period/finalize', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.finalizePeriod));
payrollRouter.post('/period/:period/unlock', authorize('ADMIN'), asyncHandler(controller.unlockPeriod));
