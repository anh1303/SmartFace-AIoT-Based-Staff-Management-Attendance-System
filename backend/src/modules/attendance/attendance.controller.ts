import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './attendance.service.js';
import {
  checkInSchema,
  adjustAttendanceSchema,
  checkOutSchema,
  aggregateAttendanceSchema,
} from './attendance.dto.js';

export const tbWebhook = async (req: Request, res: Response) => {
  const rawData = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : req.body;
  const deviceId =
    rawData?.device_id ||
    req.body?.device_id ||
    (req.headers['x-device-name'] as string) ||
    'PI4_FRONT_GATE';
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

export const statistics = async (_req: Request, res: Response) => {
  successResponse(res, await service.statistics());
};

export const checkIn = async (req: Request, res: Response) => {
  const body = checkInSchema.parse(req.body);
  const result = await service.checkIn(body, req.user);
  successResponse(res, result, 'Check-in recorded', 201);
};

export const checkOut = async (req: Request, res: Response) => {
  const body = checkOutSchema.parse(req.body);
  const result = await service.checkOut(body, req.user);
  successResponse(res, result, 'Check-out recorded', 201);
};

export const getDailySummaries = async (req: Request, res: Response) => {
  const query = { ...req.query } as Record<string, any>;
  successResponse(res, await service.getDailySummaries(query, req.user));
};

export const aggregate = async (req: Request, res: Response) => {
  const body = aggregateAttendanceSchema.parse(req.body);
  const result = await service.aggregateDailyAttendance(
    body.month,
    body.year,
    body.employeeId
  );
  successResponse(res, result, 'Aggregated attendance successfully', 201);
};

export const adjust = async (req: Request, res: Response) => {
  const body = adjustAttendanceSchema.parse(req.body);
  const result = await service.adjustAttendance(body, req.user?.id, req.user?.role);
  successResponse(res, result, 'Attendance adjusted');
};

export const getLocks = async (_req: Request, res: Response) => {
  successResponse(res, await service.getLocks());
};

export const lock = async (req: Request, res: Response) => {
  const dateStr = (req.body?.date || req.body?.work_date) as string;
  if (!dateStr) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }
  const result = await service.toggleLock(dateStr, true, req.user?.id);
  successResponse(res, result, 'Đã khóa chốt dữ liệu chấm công thành công');
};

export const unlock = async (req: Request, res: Response) => {
  const dateStr = (req.body?.date || req.body?.work_date) as string;
  if (!dateStr) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }
  const result = await service.toggleLock(dateStr, false, req.user?.id);
  successResponse(res, result, 'Đã mở khóa dữ liệu chấm công thành công');
};
