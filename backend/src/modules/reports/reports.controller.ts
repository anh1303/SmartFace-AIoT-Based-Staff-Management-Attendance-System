import type { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import { monthlyReportQuerySchema } from './reports.dto.js';
import * as service from './reports.service.js';

export const getMonthlyReport = async (req: Request, res: Response) => {
  const query = monthlyReportQuerySchema.parse(req.query);
  const data = await service.getMonthlyReport(query.period, req.user);
  successResponse(res, data);
};
