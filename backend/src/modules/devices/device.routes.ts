import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './device.controller.js';
import { authenticateFaceExtraction, faceExtractionLimiter, extractDeviceFace } from './face-extraction.js';

export const deviceRouter = Router();

// Webhook / Callback từ Raspberry Pi hoặc ThingsBoard khi chế độ đổi từ phần cứng (không cần JWT)
deviceRouter.post('/:id/mode-notify', asyncHandler(controller.modeNotify));
deviceRouter.post('/:id/settings-notify', asyncHandler(controller.settingsNotify));

deviceRouter.post('/:id/face-embedding', asyncHandler(authenticateFaceExtraction), faceExtractionLimiter, asyncHandler(extractDeviceFace));

deviceRouter.use(authenticate);

deviceRouter.get('/', asyncHandler(controller.list));
deviceRouter.get('/:id/mode', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.getMode));
deviceRouter.get('/:id', asyncHandler(controller.getById));
deviceRouter.get('/:id/mode', asyncHandler(controller.getMode));
deviceRouter.get('/:id/settings', asyncHandler(controller.getSettings));
deviceRouter.patch('/:id/settings', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.updateSettings));
deviceRouter.post('/:id/actions/test-audio', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.testAudio));
deviceRouter.post('/:id/actions/scan-wifi', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.scanWifi));
deviceRouter.post('/:id/actions/scan-bluetooth', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.scanBluetooth));
deviceRouter.post('/:id/actions/bluetooth-reconnect', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.reconnectBluetooth));
deviceRouter.post('/:id/actions/bluetooth-connect', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.connectBluetooth));
deviceRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.create));
deviceRouter.put('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.update));
deviceRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.remove));
deviceRouter.patch('/:id/mode', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.setMode));
