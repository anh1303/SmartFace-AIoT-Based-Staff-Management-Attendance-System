import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './audit.service.js';

export const listLogs = async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 100;
  successResponse(res, await service.listLogs(limit));
};