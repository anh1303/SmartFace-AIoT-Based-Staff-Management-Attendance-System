import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import { prisma } from '../../config/database.js';
import { buildIdOrCodeWhere } from '../../common/utils.js';
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

import { assertCanAccessEmployeeDetail } from '../../common/permission.helper.js';

// Xem chi tiết nhân viên:
// - ADMIN có tất cả quyền
// - MANAGER có thể xem hồ sơ nhân viên thường và chính mình, nhưng KHÔNG ĐƯỢC xem quản lý khác
// - EMPLOYEE chỉ được xem chính mình
employeeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await assertCanAccessEmployeeDetail(
      req.user,
      id,
      'Quản lý không có quyền xem thông tin chi tiết của quản lý khác'
    );
    successResponse(res, await service.get(id));
  })
);

employeeRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = createEmployeeSchema.parse(req.body);

    // Chốt chặn Requirement 3: Manager chỉ được thêm nhân viên mới có chức vụ khác quản lý
    if (req.user?.role === 'MANAGER') {
      const pos = (body.position || '').trim();
      const dept = (body.department || '').trim();
      if (
        /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(pos) ||
        /quản lý|manager/i.test(dept)
      ) {
        throw AppError.forbidden(
          'Quản lý chỉ được thêm nhân viên mới có chức vụ thông thường (không được thêm chức vụ Quản lý/Trưởng phòng)'
        );
      }
    }

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
    await assertCanAccessEmployeeDetail(
      req.user,
      id,
      'Quản lý không có quyền chỉnh sửa thông tin của quản lý khác'
    );

    const updates = updateEmployeeSchema.parse(req.body);

    if (req.user?.role === 'MANAGER') {
      // 1. Manager không thể thăng chức ai đó thành Quản lý
      const pos = (updates.position || '').trim();
      const dept = (updates.department || '').trim();
      if (
        (pos && /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(pos)) ||
        (dept && /quản lý|manager/i.test(dept))
      ) {
        throw AppError.forbidden('Quản lý không được phép gán hoặc chuyển đổi sang chức vụ Quản lý');
      }

      // 2. Không ai được tự sửa thông tin kiểm soát của chính mình (chức vụ, phòng ban, mức lương)
      const emp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(id),
      });
      if (emp?.user_id === req.user.id) {
        if (
          updates.hourly_rate !== undefined ||
          updates.position !== undefined ||
          updates.department !== undefined ||
          updates.departmentId !== undefined ||
          updates.status !== undefined
        ) {
          throw AppError.forbidden(
            'Không ai được tự sửa dữ liệu kiểm soát của chính mình (mức lương/chức vụ/phòng ban/trạng thái hoạt động). Vui lòng liên hệ Admin phê duyệt!'
          );
        }
      }
    }

    successResponse(
      res,
      await service.update(id, updates, req.user?.id),
      'Employee updated'
    );
  })
);

employeeRouter.post(
  '/:id/reset-password',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await assertCanAccessEmployeeDetail(
      req.user,
      id,
      'Quản lý không có quyền đặt lại mật khẩu cho quản lý khác'
    );
    const result = await service.resetPassword(id, req.user?.id);
    successResponse(res, result, 'Đặt lại mật khẩu thành công');
  })
);

employeeRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await service.remove(id, req.user?.id);
    successResponse(res, null, 'Employee deleted');
  })
);