import { getEmployeeScope, assertCanManageEmployee } from '../employees/employee.permission.js';
import { workDateSchema } from '../../common/date.schema.js';
import { assertDeviceWebhook } from '../../common/device-auth.js';
import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './attendance.service.js';
import {
  checkInSchema,
  adjustAttendanceSchema,
  checkOutSchema,
  aggregateAttendanceSchema,
  devSimulateFaceScanSchema,
} from './attendance.dto.js';

export const tbWebhook = async (req: Request, res: Response) => {
  assertDeviceWebhook(req);
  const rawData = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : req.body;
  const originName = req.headers['x-device-name'];
  const deviceId = rawData?.device_id;
  if (!deviceId || (originName && originName !== deviceId)) {
    return res.status(400).json({ success: false, message: 'Tên thiết bị không khớp originator ThingsBoard' });
  }
  const result = await service.handleThingsBoardWebhook({
    ...rawData,
    device_id: deviceId,
  });
  res.status(200).json(result);
};

export const list = async (req: Request, res: Response) => {
  const query = { ...req.query } as Record<string, any>;
  successResponse(res, await service.list(query, req.user));
};

export const statistics = async (req: Request, res: Response) => {
  successResponse(res, await service.statistics(req.user));
};

export const checkIn = async (req: Request, res: Response) => {
  const body = checkInSchema.parse(req.body);
  const result = await service.checkIn(body, req.user, { eventId: body.event_id, reason: body.reason });
  successResponse(res, result, 'Check-in recorded', 201);
};

export const checkOut = async (req: Request, res: Response) => {
  const body = checkOutSchema.parse(req.body);
  const targetEmployeeId = body.employeeId || (body as any).employee_id;
  const result = await service.checkOut(targetEmployeeId, body.device_info, req.user, { eventId: body.event_id, reason: body.reason });
  successResponse(res, result, 'Check-out recorded', 201);
};

export const devSimulateFace = async (req: Request, res: Response) => {
  const body = devSimulateFaceScanSchema.parse(req.body);
  const result = await service.devSimulateFaceScan(body, req.user);
  successResponse(res, result, 'Đã giả lập quét mặt thành công (Dev Mode)', 201);
};

export const getDailySummaries = async (req: Request, res: Response) => {
  const query = { ...req.query } as Record<string, any>;
  successResponse(res, await service.getDailySummaries(query, req.user));
};

export const aggregate = async (req: Request, res: Response) => {
  const body = aggregateAttendanceSchema.parse(req.body);
  if (body.employeeId) await assertCanManageEmployee(req.user, body.employeeId);
  const scope = await getEmployeeScope(req.user, 'manage');
  const result = await service.aggregateDailyAttendance(
    body.month,
    body.year,
    body.employeeId,
    undefined,
    scope
  );
  successResponse(res, result, 'Aggregated attendance successfully', 201);
};

export const adjust = async (req: Request, res: Response) => {
  const body = adjustAttendanceSchema.parse(req.body);
  const result = await service.adjustAttendance(body, req.user?.id, req.user?.role);
  successResponse(res, result, 'Attendance adjusted');
};

export const getLocks = async (req: Request, res: Response) => {
  successResponse(res, await service.getLocks(req.user));
};

export const lock = async (req: Request, res: Response) => {
  const dateStr = workDateSchema.parse(req.body?.date || req.body?.work_date);
  if (!dateStr) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }
  const result = await service.toggleLock(dateStr, true, req.user?.id, req.user?.role);
  successResponse(res, result, 'Đã khóa chốt dữ liệu chấm công thành công');
};

export const unlock = async (req: Request, res: Response) => {
  const dateStr = workDateSchema.parse(req.body?.date || req.body?.work_date);
  if (!dateStr) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }
  const result = await service.toggleLock(dateStr, false, req.user?.id, req.user?.role);
  successResponse(res, result, 'Đã mở khóa dữ liệu chấm công thành công');
};
