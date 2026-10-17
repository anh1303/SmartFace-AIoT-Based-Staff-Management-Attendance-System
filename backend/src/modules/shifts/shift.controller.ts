import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import * as service from './shift.service.js';
import { assignShiftSchema } from './shift.dto.js';

export const list = async (req: Request, res: Response) => {
  const query = { ...req.query } as Record<string, any>;
  successResponse(res, await service.list(query, req.user));
};

export const assignShift = async (req: Request, res: Response) => {
  const body = assignShiftSchema.parse(req.body);
  const empId = (body.employee_id || body.employeeId)!;
  const dateStr = (body.date || body.work_date)!;

  const result = await service.assignOrUpdateWithPermissionCheck(
    {
      employee_id: empId,
      date: dateStr,
      work_day: body.work_day,
      shift_type: body.shift_type,
      start_time: body.start_time,
      end_time: body.end_time,
      note: body.note,
    },
    req.user
  );
  successResponse(res, result, 'Shift assigned successfully', 201);
};