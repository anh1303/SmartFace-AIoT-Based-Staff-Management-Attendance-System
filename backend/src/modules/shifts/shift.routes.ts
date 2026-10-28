import {shiftTemplateSchema} from './template.dto.js';
import {listShiftTemplates,createShiftTemplate} from './template.service.js';
import {successResponse} from '../../common/response.js';
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './shift.controller.js';

export const shiftRouter = Router();

shiftRouter.use(authenticate);

shiftRouter.get('/templates', authorize('ADMIN','MANAGER'), asyncHandler(async(req,res)=>{successResponse(res,await listShiftTemplates());}));
shiftRouter.post('/templates', authorize('ADMIN','MANAGER'), asyncHandler(async(req,res)=>{const input=shiftTemplateSchema.parse(req.body);successResponse(res,await createShiftTemplate(input,req.user!.id),'Đã tạo ca tùy chỉnh',201);}));

shiftRouter.get('/',  asyncHandler(controller.list));
shiftRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(controller.assignShift));
