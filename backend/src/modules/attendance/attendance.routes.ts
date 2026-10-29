import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './attendance.controller.js';

export const attendanceRouter = Router();

// Webhook từ ThingsBoard Rule Chain (Hỗ trợ cả REST Webhook và Two-way RPC) - Không cần JWT người dùng
attendanceRouter.post('/tb-webhook', asyncHandler(controller.tbWebhook));

attendanceRouter.use(authenticate);

attendanceRouter.get('/', asyncHandler(controller.list));
attendanceRouter.get('/statistics', asyncHandler(controller.statistics));
attendanceRouter.post('/check-in', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.checkIn));
attendanceRouter.post('/check-out', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.checkOut));
attendanceRouter.post('/dev-simulate-face', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.devSimulateFace));
attendanceRouter.get('/summaries', asyncHandler(controller.getDailySummaries));
attendanceRouter.post('/aggregate', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.aggregate));
attendanceRouter.patch('/adjust', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.adjust));
attendanceRouter.get('/locks', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.getLocks));
attendanceRouter.post('/locks/lock', authorize('ADMIN'), asyncHandler(controller.lock));
attendanceRouter.post('/locks/unlock', authorize('ADMIN'), asyncHandler(controller.unlock));
