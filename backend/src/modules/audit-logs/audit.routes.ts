import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './audit.controller.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

// Audit logs — Chỉ ADMIN mới có quyền xem kiểm toán hệ thống
auditRouter.get('/', authorize('ADMIN'), asyncHandler(controller.listLogs));
