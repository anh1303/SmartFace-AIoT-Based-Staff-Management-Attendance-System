import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './position.controller.js';

export const positionRouter = Router();
positionRouter.use(authenticate);

positionRouter.get('/', asyncHandler(controller.listPositions));
positionRouter.post('/', authorize('ADMIN'), asyncHandler(controller.createPosition));
positionRouter.put('/:id', authorize('ADMIN'), asyncHandler(controller.updatePosition));
positionRouter.delete('/:id', authorize('ADMIN'), asyncHandler(controller.deletePosition));
