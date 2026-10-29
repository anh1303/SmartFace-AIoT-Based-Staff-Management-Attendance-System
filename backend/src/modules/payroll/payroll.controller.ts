import * as adjustments from './payroll.adjustments.js';
import { reviewAdjustmentSchema } from './payroll.dto.js';
import { z } from 'zod';
import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './payroll.service.js';
import {
  updateBonusPenaltySchema,
  generatePayrollSchema,
  updatePayrollSchema,
  earlySettlementSchema,
} from './payroll.dto.js';

export const getBonusPenalty = async (_req: Request, res: Response) => {
  successResponse(res, await service.getBonusPenalty());
};

export const updateBonusPenalty = async (req: Request, res: Response) => {
  const body = updateBonusPenaltySchema.parse(req.body);
  successResponse(res, await service.updateBonusPenalty(body, req.user?.id), 'Cập nhật quy định thưởng/phạt thành công');
};

export const list = async (req: Request, res: Response) => {
  const period = typeof req.query.payroll_period === 'string' ? req.query.payroll_period : undefined;
  const targetEmployee = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
  successResponse(res, await service.list(period, targetEmployee, req.user));
};

export const generate = async (req: Request, res: Response) => {
  const body = generatePayrollSchema.parse(req.body);
  const targetPeriod = (body.payroll_period || body.period)!;

  successResponse(
    res,
    await service.generate(targetPeriod, body.employeeId, req.user?.id, req.user),
    'Payroll generated',
    201
  );
};

export const updateItem = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updates = updatePayrollSchema.parse(req.body);
  successResponse(res, await service.updateItem(id, updates, req.user), 'Payroll updated');
};

export const finalizePeriod = async (req: Request, res: Response) => {
  const period = req.params.period as string;
  successResponse(res, await service.finalizePeriod(period, req.user?.id, req.user?.role), 'Payroll period finalized');
};

export const finalizeEarlySettlement = async (req: Request, res: Response) => {
  const body = earlySettlementSchema.parse(req.body);
  successResponse(
    res,
    await service.finalizeEarlySettlement(body, req.user?.id, req.user?.role),
    'Đã quyết toán sớm bảng lương nhân viên thành công'
  );
};

export const unlockPeriod = async (req: Request, res: Response) => {
  const period = req.params.period as string;
  successResponse(res, await service.unlockPeriod(period, req.user?.id), 'Payroll period unlocked');
};

export const previewEarlySettlement = async (req: Request, res: Response) => {
  const body = earlySettlementSchema.parse(req.body);
  successResponse(res, await service.previewEarlySettlement(body, req.user?.id, req.user?.role));
};

export const listAdjustments = async (req: Request, res: Response) => {
  const query = z.object({ period: z.string(), employeeId: z.string().optional() }).parse(req.query);
  successResponse(res, await adjustments.listAdjustments(query.period, query.employeeId, req.user!));
};
export const reviewAdjustment = async (req: Request, res: Response) => {
  const id = z.string().regex(/^\d+$/).parse(req.params.id);
  successResponse(res, await adjustments.reviewAdjustment(id, reviewAdjustmentSchema.parse(req.body), req.user!));
};
