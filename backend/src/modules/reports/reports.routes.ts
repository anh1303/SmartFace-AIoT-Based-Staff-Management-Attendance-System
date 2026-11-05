import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './reports.controller.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

// Báo cáo tổng hợp tháng - Chỉ ADMIN và MANAGER được phép truy cập
reportsRouter.get('/monthly', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.getMonthlyReport));
