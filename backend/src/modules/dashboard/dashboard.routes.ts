import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

// Báo cáo tổng quan hôm nay - ADMIN và MANAGER
dashboardRouter.get('/today', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.getTodayDashboard));
