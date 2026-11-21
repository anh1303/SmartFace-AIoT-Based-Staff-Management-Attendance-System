import { inquiryRouter } from './inquiry.routes.js';
import { profileRouter } from './profile.routes.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as controller from './auth.controller.js';
import { faceLoginRouter } from './face-login/face-login.routes.js';

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
export const LOGIN_RATE_LIMIT_MAX = 20;

export const createLoginRateLimiter = (
  overrides?: { windowMs?: number; limit?: number }
) =>
  rateLimit({
    windowMs: overrides?.windowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: overrides?.limit ?? LOGIN_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.',
      code: 'IP_RATE_LIMIT',
    },
  });

export const authRouter = Router();
const loginLimiter = createLoginRateLimiter();

authRouter.use('/solution-inquiries', inquiryRouter);

authRouter.post('/login', loginLimiter, asyncHandler(controller.login));
authRouter.post('/logout', controller.logout);
authRouter.use('/face-login', faceLoginRouter);
authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post('/register', authenticate, authorize('ADMIN'), asyncHandler(controller.register));

authRouter.use(profileRouter);
