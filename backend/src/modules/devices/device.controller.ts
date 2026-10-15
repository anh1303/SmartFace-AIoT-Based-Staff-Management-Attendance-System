import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import * as service from './device.service.js';
import { emitDeviceEvent } from '../../sockets/device.gateway.js';
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js';
import { createDeviceSchema, updateDeviceSchema } from './device.dto.js';

export const deviceRouter = Router();

// Webhook / Callback từ Raspberry Pi hoặc ThingsBoard khi chế độ đổi từ phần cứng (không cần JWT)
deviceRouter.post(
  '/:id/mode-notify',
  asyncHandler(async (req, res) => {
    const { mode } = req.body;
    if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
    }
    console.log(`[Device Mode Notify] Thiết bị ${req.params.id} thông báo đổi chế độ: ${mode}`);
    emitDeviceEvent('mode-changed', { id: req.params.id, mode });
    emitAttendanceEvent('device-mode-changed', { deviceId: req.params.id, mode });
    successResponse(res, { deviceId: req.params.id, mode }, 'Mode notification received');
  })
);

deviceRouter.use(authenticate);

deviceRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.list());
  })
);

deviceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    successResponse(res, await service.get(req.params.id));
  })
);

deviceRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const device = await service.create(createDeviceSchema.parse(req.body), req.user?.id);
    emitDeviceEvent('created', device);
    successResponse(res, device, 'Device created', 201);
  })
);

deviceRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const device = await service.update(String(req.params.id), updateDeviceSchema.parse(req.body), req.user?.id);
    emitDeviceEvent('updated', device);
    successResponse(res, device, 'Device updated');
  })
);

deviceRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    await service.remove(String(req.params.id), req.user?.id);
    successResponse(res, null, 'Device deleted');
  })
);

deviceRouter.post(
  '/:id/mode',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { mode } = req.body;
    if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
    }
    const result = await service.setDeviceAttendanceMode(String(req.params.id), mode);
    emitDeviceEvent('mode-changed', { id: req.params.id, mode });
    emitAttendanceEvent('device-mode-changed', { deviceId: req.params.id, mode });
    successResponse(res, result, `Chuyển chế độ thiết bị sang ${mode} thành công`);
  })
);