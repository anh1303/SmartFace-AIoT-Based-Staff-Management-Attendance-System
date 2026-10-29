import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './device.controller.js';
import { authenticateFaceExtraction, faceExtractionLimiter, extractDeviceFace } from './face-extraction.js';

export const deviceRouter = Router();

// Webhook / Callback từ Raspberry Pi hoặc ThingsBoard khi chế độ đổi từ phần cứng (không cần JWT)
deviceRouter.post('/:id/mode-notify', asyncHandler(controller.modeNotify));

deviceRouter.post('/:id/face-embedding', asyncHandler(authenticateFaceExtraction), faceExtractionLimiter, asyncHandler(extractDeviceFace));

deviceRouter.use(authenticate, authorize('ADMIN'));

deviceRouter.get('/', asyncHandler(controller.list));
deviceRouter.get('/:id/mode', authorize('ADMIN'), asyncHandler(controller.getMode));
deviceRouter.get('/:id', asyncHandler(controller.getById));
deviceRouter.get('/:id/mode', asyncHandler(controller.getMode));
deviceRouter.post('/', authorize('ADMIN'), asyncHandler(controller.create));
deviceRouter.put('/:id', authorize('ADMIN'), asyncHandler(controller.update));
deviceRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.remove));
deviceRouter.patch('/:id/mode', authorize('ADMIN'), asyncHandler(controller.setMode));
