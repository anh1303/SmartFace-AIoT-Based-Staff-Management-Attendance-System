import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import { createEmployeeSchema, updateEmployeeSchema } from './employee.dto.js';
import * as service from './employee.service.js';


export const list = async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query));
};

export const create = async (req: Request, res: Response) => {
  const body = createEmployeeSchema.parse(req.body);
  const result = await service.createWithManagerCheck(body, req.user?.id, req.user?.role);
  successResponse(res, result, 'Employee created', 201);
};

export const update = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updates = updateEmployeeSchema.parse(req.body);
  successResponse(res, await service.updateWithManagerCheck(id, updates, req.user), 'Employee updated');
};

export const remove = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await service.remove(id, req.user?.id);
  successResponse(res, null, 'Employee deactivated');
};

export const getById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  successResponse(res, await service.getByIdWithManagerCheck(id, req.user));
};

export const resetPassword = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  successResponse(res, await service.resetPassword(id, req.user?.id), 'Mật khẩu đã được đặt lại thành công');
};