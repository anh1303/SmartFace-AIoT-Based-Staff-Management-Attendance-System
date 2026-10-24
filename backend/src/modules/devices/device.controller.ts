import { assertDeviceWebhook } from '../../common/device-auth.js';
import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import { eventBus } from '../../common/event-bus.js';
import * as service from './device.service.js';
import { createDeviceSchema, updateDeviceSchema } from './device.dto.js';

export const modeNotify = async (req: Request, res: Response) => {
  if (process.env.TB_WEBHOOK_SECRET) {
    assertDeviceWebhook(req);
  }
  const mode = req.body.mode || req.body.current_mode || req.body.attendance_mode;
  if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
  }
  console.log(`[Device Mode Notify] Thiết bị ${req.params.id} thông báo đổi chế độ: ${mode}`);
  const state = service.recordDeviceModeNotify(req.params.id, mode);
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    service.persistConfirmedAttendanceMode(String(req.params.id), mode).catch(() => {});
  }
  eventBus.publish('device:mode-updated', { deviceId: req.params.id, mode, confirmed: true });
  successResponse(res, { deviceId: req.params.id, mode, confirmed: true, lastUpdated: state.lastUpdated }, 'Mode notification received');
};

export const list = async (_req: Request, res: Response) => {
  successResponse(res, await service.list());
};

export const getById = async (req: Request, res: Response) => {
  successResponse(res, await service.get(String(req.params.id)));
};

export const create = async (req: Request, res: Response) => {
  const device = await service.create(createDeviceSchema.parse(req.body), req.user?.id);
  eventBus.publish('device:created', device);
  successResponse(res, device, 'Device created', 201);
};

export const update = async (req: Request, res: Response) => {
  const device = await service.update(String(req.params.id), updateDeviceSchema.parse(req.body), req.user?.id);
  eventBus.publish('device:updated', device);
  successResponse(res, device, 'Device updated');
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(String(req.params.id), req.user?.id);
  eventBus.publish('device:deleted', { id: req.params.id });
  successResponse(res, null, 'Device deleted');
};

export const setMode = async (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
  }
  const result = await service.setDeviceAttendanceMode(String(req.params.id), mode);
  eventBus.publish('device:mode-updated', { deviceId: req.params.id, mode, confirmed: result.confirmed });
  if (result.confirmed) {
    successResponse(res, result, `Pi đã xác nhận ${mode}`);
  } else {
    successResponse(res, result, `Lệnh chuyển sang ${mode} đã gửi nhưng chưa nhận được xác nhận (ACK) từ Pi`);
  }
};

export const getMode = async (req: Request, res: Response) => {
  const result = await service.getDeviceMode(String(req.params.id));
  successResponse(res, result);
};
