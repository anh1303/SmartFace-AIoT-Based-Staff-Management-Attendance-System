import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(controller.login));
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post('/register', authenticate, authorize('ADMIN'), asyncHandler(controller.register));
