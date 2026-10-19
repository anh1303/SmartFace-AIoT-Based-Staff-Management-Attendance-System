import { assertDeviceWebhook } from '../../common/device-auth.js';
import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './device.service.js';
import { emitDeviceEvent } from '../../sockets/device.gateway.js';
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js';
import { createDeviceSchema, updateDeviceSchema } from './device.dto.js';

export const modeNotify = async (req: Request, res: Response) => {
  assertDeviceWebhook(req);
  const mode = req.body.mode || req.body.current_mode || req.body.attendance_mode;
  if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
  }
  const confirmed = await service.getDeviceAttendanceMode(String(req.params.id));
  if (confirmed.mode !== mode) return res.status(409).json({ success: false, message: 'Chế độ chưa được Pi xác nhận' });
  await service.persistConfirmedAttendanceMode(String(req.params.id), mode);
  console.log(`[Device Mode Notify] Thiết bị ${req.params.id} thông báo đổi chế độ: ${mode}`);
  emitDeviceEvent('mode-changed', { id: req.params.id, mode });
  emitAttendanceEvent('device-mode-changed', { deviceId: req.params.id, mode });
  successResponse(res, { deviceId: req.params.id, mode }, 'Mode notification received');
};

export const list = async (_req: Request, res: Response) => {
  successResponse(res, await service.list());
};

export const getById = async (req: Request, res: Response) => {
  successResponse(res, await service.get(String(req.params.id)));
};

export const create = async (req: Request, res: Response) => {
  const device = await service.create(createDeviceSchema.parse(req.body), req.user?.id);
  emitDeviceEvent('created', device);
  successResponse(res, device, 'Device created', 201);
};

export const update = async (req: Request, res: Response) => {
  const device = await service.update(String(req.params.id), updateDeviceSchema.parse(req.body), req.user?.id);
  emitDeviceEvent('updated', device);
  successResponse(res, device, 'Device updated');
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(String(req.params.id), req.user?.id);
  emitDeviceEvent('deleted', { id: req.params.id });
  successResponse(res, null, 'Device deleted');
};

export const setMode = async (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!mode || !['CHECK_IN', 'CHECK_OUT'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid mode: must be CHECK_IN or CHECK_OUT' });
  }
  const result = await service.setDeviceAttendanceMode(String(req.params.id), mode);
  emitDeviceEvent('mode-changed', { id: req.params.id, ...result });
  emitAttendanceEvent('device-mode-changed', result);
  successResponse(res, result, `Pi đã xác nhận ${mode}`);
};
export const getMode = async (req: Request, res: Response) => { successResponse(res, await service.getDeviceAttendanceMode(String(req.params.id))); };
