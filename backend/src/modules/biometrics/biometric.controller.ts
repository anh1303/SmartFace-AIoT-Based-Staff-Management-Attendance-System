import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import { assertCanAccessEmployeeDetail } from '../employees/index.js';
import * as service from './biometric.service.js';
import { enrollImagesSchema } from './biometric.dto.js';

export const getByEmployee = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  await assertCanAccessEmployeeDetail(
    req.user,
    employeeId,
    'Quản lý không có quyền xem dữ liệu sinh trắc học của quản lý khác'
  );
  successResponse(res, await service.getByEmployee(employeeId));
};

export const enrollImages = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  const body = enrollImagesSchema.parse(req.body);
  const result = await service.enrollImagesWithPermissionCheck(
    employeeId,
    body.images,
    req.user
  );
  successResponse(res, result, 'Biometric images enrolled successfully', 201);
};

export const deactivate = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  await service.deactivate(employeeId, req.user);
  successResponse(res, null, 'Biometric profile deactivated');
};

export const removeAll = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  await service.removeAllWithPermissionCheck(employeeId, req.user);
  successResponse(res, null, 'All biometric data deleted');
};
