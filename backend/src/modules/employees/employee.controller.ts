import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import { prisma } from '../../config/database.js';
import * as service from './employee.service.js';
import { createEmployeeSchema, updateEmployeeSchema } from './employee.dto.js';

export const employeeRouter = Router();
employeeRouter.use(authenticate);

// 17. Chỉ ADMIN và MANAGER mới được phép xem danh sách toàn bộ nhân viên + thông tin lương
employeeRouter.get(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    successResponse(res, await service.list(req.query));
  })
);

// Xem chi tiết nhân viên: ADMIN / MANAGER xem tất cả, EMPLOYEE chỉ xem được chính mình
employeeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      });
      if (!emp) {
        throw AppError.notFound('Không tìm thấy thông tin hồ sơ nhân viên của bạn');
      }
      const isSelf = emp.id === id || emp.employee_code === id;
      if (!isSelf) {
        throw AppError.forbidden('Bạn không có quyền xem thông tin của nhân viên khác');
      }
    }
    successResponse(res, await service.get(id));
  })
);

employeeRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = createEmployeeSchema.parse(req.body);
    const empData = {
      ...body,
      employee_code: body.employee_code || body.employee_id,
      departmentId: body.departmentId || body.department_id,
    };
    successResponse(res, await service.create(empData, req.user?.id), 'Employee created', 201);
  })
);

employeeRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    successResponse(
      res,
      await service.update(id, updateEmployeeSchema.parse(req.body), req.user?.id),
      'Employee updated'
    );
  })
);

employeeRouter.delete(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await service.remove(id, req.user?.id);
    successResponse(res, null, 'Employee deleted');
  })
);