import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './position.service.js';

export const listPositions = async (_req: Request, res: Response) => {
  successResponse(res, await service.listPositions());
};

export const createPosition = async (req: Request, res: Response) => {
  const created = await service.createPosition(req.body, req.user?.id);
  successResponse(res, created, 'Đã tạo chức vụ mới thành công', 201);
};

export const updatePosition = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const updated = await service.updatePosition(id, req.body, req.user?.id);
  successResponse(res, updated, 'Đã cập nhật chức vụ thành công');
};

export const deletePosition = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  await service.deletePosition(id, req.user?.id);
  successResponse(res, null, 'Đã xóa chức vụ thành công');
};

