import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import * as service from './position.service.js';

export const positionRouter = Router();
positionRouter.use(authenticate);

positionRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.listPositions());
  })
);

positionRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const created = await service.createPosition(req.body, req.user?.id);
    successResponse(res, created, 'Đã tạo chức vụ mới thành công', 201);
  })
);

positionRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id as string, 10);
    const updated = await service.updatePosition(id, req.body, req.user?.id);
    successResponse(res, updated, 'Đã cập nhật chức vụ thành công');
  })
);

positionRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id as string, 10);
    await service.deletePosition(id, req.user?.id);
    successResponse(res, null, 'Đã xóa chức vụ thành công');
  })
);
