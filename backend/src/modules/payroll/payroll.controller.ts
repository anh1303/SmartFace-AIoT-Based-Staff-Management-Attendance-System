import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { prisma } from '../../config/database.js';
import * as service from './payroll.service.js';
import {
  updateBonusPenaltySchema,
  generatePayrollSchema,
  updatePayrollSchema,
} from './payroll.dto.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);

payrollRouter.get(
  '/bonus-penalty',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.getBonusPenalty());
  })
);

payrollRouter.put(
  '/bonus-penalty',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = updateBonusPenaltySchema.parse(req.body);
    successResponse(res, await service.updateBonusPenalty(body, req.user?.id), 'Cập nhật quy định thưởng/phạt thành công');
  })
);

payrollRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const period = typeof req.query.payroll_period === 'string' ? req.query.payroll_period : undefined;
    let targetEmployee: string | undefined = undefined;

    // 18. Phân quyền chặt chẽ: Nhân viên (EMPLOYEE) chỉ xem được bảng lương của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      });
      if (!emp) {
        return successResponse(res, []);
      }
      targetEmployee = emp.id;
    } else if (typeof req.query.employeeId === 'string') {
      targetEmployee = req.query.employeeId;
    }

    successResponse(res, await service.list(period, targetEmployee));
  })
);

payrollRouter.post(
  '/generate',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = generatePayrollSchema.parse(req.body);
    const targetPeriod = (body.payroll_period || body.period)!;

    successResponse(
      res,
      await service.generate(targetPeriod, body.employeeId, req.user?.id),
      'Payroll generated',
      201
    );
  })
);

payrollRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const updates = updatePayrollSchema.parse(req.body);
    successResponse(res, await service.updateItem(id, updates, req.user?.id), 'Payroll updated');
  })
);

payrollRouter.post(
  '/period/:period/finalize',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const period = req.params.period as string;
    successResponse(res, await service.finalizePeriod(period, req.user?.id), 'Payroll period finalized');
  })
);

payrollRouter.post(
  '/period/:period/unlock',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const period = req.params.period as string;
    successResponse(res, await service.unlockPeriod(period, req.user?.id), 'Payroll period unlocked');
  })
);
