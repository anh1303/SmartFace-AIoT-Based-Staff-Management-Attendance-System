import type { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './dashboard.service.js';

export const getTodayDashboard = async (req: Request, res: Response) => {
  const data = await service.getTodayDashboard(req.user);
  successResponse(res, data);
};
