import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import * as service from './department.service.js';

export const departmentRouter = Router();
departmentRouter.use(authenticate);

departmentRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.listDepartments());
  })
);

departmentRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const created = await service.createDepartment(req.body, req.user?.id);
    successResponse(res, created, 'Đã tạo chức vụ mới thành công', 201);
  })
);

departmentRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id as string, 10);
    const updated = await service.updateDepartment(id, req.body, req.user?.id);
    successResponse(res, updated, 'Đã cập nhật chức vụ thành công');
  })
);

departmentRouter.delete(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id as string, 10);
    await service.deleteDepartment(id, req.user?.id);
    successResponse(res, null, 'Đã xóa chức vụ thành công');
  })
);
