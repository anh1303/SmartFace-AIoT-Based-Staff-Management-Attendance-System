import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { prisma } from '../../config/database.js';
import * as service from './shift.service.js';
import { assignShiftSchema } from './shift.dto.js';

import { buildIdOrCodeWhere } from '../../common/utils.js';
import { AppError } from '../../common/AppError.js';
import { isEmployeeManager } from '../../common/permission.helper.js';

export const shiftRouter = Router();
shiftRouter.use(authenticate);

shiftRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = { ...req.query } as Record<string, any>;

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được lịch phân ca của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      });
      if (!emp) {
        return successResponse(res, []);
      }
      query.employee_id = emp.id;
    }

    successResponse(res, await service.list(query));
  })
);

shiftRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = assignShiftSchema.parse(req.body);

    const empId = (body.employee_id || body.employeeId)!;
    const dateStr = (body.date || body.work_date)!;

    // Chốt chặn Requirement 2: Không ai được tự phân ca hoặc sửa ca làm việc của chính mình
    if (req.user?.role !== 'ADMIN') {
      const targetEmp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(empId),
        include: {
          department: true,
          users: {
            select: {
              id: true,
              roles: { select: { role_name: true } },
            },
          },
        },
      });

      if (!targetEmp) {
        throw AppError.notFound('Không tìm thấy nhân viên');
      }

      if (targetEmp.user_id === req.user?.id) {
        throw AppError.forbidden(
          'Không ai được tự sửa hoặc phân ca làm việc của chính mình. Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!'
        );
      }

      // Manager không được sửa ca của Manager khác
      if (req.user?.role === 'MANAGER' && isEmployeeManager(targetEmp)) {
        throw AppError.forbidden('Quản lý không có quyền phân ca hoặc sửa đổi ca làm việc của quản lý khác!');
      }
    }

    const result = await service.assignOrUpdate(
      {
        ...body,
        employee_id: empId,
        date: dateStr,
      },
      req.user?.id
    );
    successResponse(res, result, 'Work shift saved', 200);
  })
);