import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './device.controller.js';

export const deviceRouter = Router();

// Webhook / Callback từ Raspberry Pi hoặc ThingsBoard khi chế độ đổi từ phần cứng (không cần JWT)
deviceRouter.post('/:id/mode-notify', asyncHandler(controller.modeNotify));

deviceRouter.use(authenticate);

deviceRouter.get('/', asyncHandler(controller.list));
deviceRouter.get('/:id', asyncHandler(controller.getById));
deviceRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.create));
deviceRouter.put('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.update));
deviceRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.remove));
deviceRouter.patch('/:id/mode', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.setMode));
