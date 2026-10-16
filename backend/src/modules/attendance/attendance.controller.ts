import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import { prisma } from '../../config/database.js';
import { buildIdOrCodeWhere } from '../../common/utils.js';
import * as service from './attendance.service.js';
import { emitAttendanceEvent } from '../../sockets/attendance.gateway.js';
import {
  checkInSchema,
  adjustAttendanceSchema,
  checkOutSchema,
  aggregateAttendanceSchema,
} from './attendance.dto.js';

export const attendanceRouter = Router();

// Webhook từ ThingsBoard Rule Chain (Hỗ trợ cả REST Webhook và Two-way RPC) - Không cần JWT người dùng
attendanceRouter.post(
  '/tb-webhook',
  asyncHandler(async (req, res) => {
    // Nếu payload gửi qua RPC ({ method, params }), trích xuất params
    const rawData = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : req.body;
    const deviceId =
      rawData?.device_id ||
      req.body?.device_id ||
      (req.headers['x-device-name'] as string) ||
      'PI4_FRONT_GATE';
    const result = await service.handleThingsBoardWebhook({
      ...rawData,
      device_id: deviceId,
    });
    // Phản hồi thẳng JSON kết quả để TbSendRPCReplyNode đóng gói gửi về Pi 4
    res.status(200).json(result);
  })
);

attendanceRouter.use(authenticate);

attendanceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = { ...req.query } as Record<string, any>;

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được lịch sử điểm danh của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      });
      if (!emp) {
        return successResponse(res, []);
      }
      query.employeeId = emp.id;
    }

    successResponse(res, await service.list(query));
  })
);

attendanceRouter.get(
  '/statistics',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.statistics());
  })
);

attendanceRouter.post(
  ['/check-in', '/checkin'],
  asyncHandler(async (req, res) => {
    const body = checkInSchema.parse(req.body);

    // 20. Phân quyền chặt chẽ: EMPLOYEE chỉ được phép chấm công cho chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(body.employeeId),
      });
      if (!emp || emp.user_id !== req.user.id) {
        throw AppError.forbidden('Nhân viên chỉ được phép thực hiện chấm công vào cho chính mình!');
      }
    }

    const record = await service.checkIn({
      employeeId: body.employeeId,
      device_info: body.device_info,
      method: body.method,
    });
    emitAttendanceEvent('checked-in', record);
    successResponse(res, record, 'Checked in', 201);
  })
);

attendanceRouter.get(
  '/summaries',
  asyncHandler(async (req, res) => {
    const query = { ...req.query } as Record<string, any>;

    // Phân quyền: Nhân viên (EMPLOYEE) chỉ xem được tổng hợp công hàng ngày của chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: { user_id: req.user.id },
      });
      if (!emp) {
        return successResponse(res, []);
      }
      query.employeeId = emp.id;
    }

    successResponse(res, await service.getDailySummaries(query));
  })
);

attendanceRouter.patch(
  '/adjust',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = adjustAttendanceSchema.parse(req.body);
    const updated = await service.adjustAttendance(body, req.user?.id, req.user?.role);
    successResponse(res, updated, 'Attendance adjusted successfully');
  })
);

attendanceRouter.post(
  ['/check-out', '/checkout'],
  asyncHandler(async (req, res) => {
    const body = checkOutSchema.parse(req.body);

    // 20. Phân quyền chặt chẽ: EMPLOYEE chỉ được phép chấm công ra cho chính mình
    if (req.user?.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: buildIdOrCodeWhere(body.employeeId),
      });
      if (!emp || emp.user_id !== req.user.id) {
        throw AppError.forbidden('Nhân viên chỉ được phép thực hiện chấm công ra cho chính mình!');
      }
    }

    const record = await service.checkOut(body.employeeId, body.device_info);
    emitAttendanceEvent('checked-out', record);
    successResponse(res, record, 'Checked out');
  })
);

attendanceRouter.get(
  '/locks',
  asyncHandler(async (_req, res) => {
    successResponse(res, await service.getLocks());
  })
);

attendanceRouter.post(
  '/locks/lock',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { date } = req.body;
    if (!date) throw AppError.badRequest('Date is required');
    successResponse(res, await service.toggleLock(date, true, req.user?.id), 'Date locked');
  })
);

attendanceRouter.post(
  '/locks/unlock',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const { date } = req.body;
    if (!date) throw AppError.badRequest('Date is required');
    successResponse(res, await service.toggleLock(date, false, req.user?.id), 'Date unlocked');
  })
);

attendanceRouter.post(
  '/aggregate',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = aggregateAttendanceSchema.parse(req.body);
    const result = await service.aggregateDailyAttendance(body.month, body.year, body.employeeId);
    successResponse(res, result, 'Dữ liệu chấm công đã được tổng hợp thành công');
  })
);
