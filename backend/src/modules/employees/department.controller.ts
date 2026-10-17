import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './department.service.js';

export const listDepartments = async (_req: Request, res: Response) => {
  successResponse(res, await service.listDepartments());
};

export const createDepartment = async (req: Request, res: Response) => {
  const created = await service.createDepartment(req.body, req.user?.id);
  successResponse(res, created, 'Đã tạo phòng ban mới thành công', 201);
};

export const updateDepartment = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const updated = await service.updateDepartment(id, req.body, req.user?.id);
  successResponse(res, updated, 'Đã cập nhật phòng ban thành công');
};

export const deleteDepartment = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  await service.deleteDepartment(id, req.user?.id);
  successResponse(res, null, 'Đã xóa phòng ban thành công');
};

