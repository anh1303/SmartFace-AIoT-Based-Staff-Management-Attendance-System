import { Router } from 'express';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import { loginSchema, registerSchema } from './auth.dto.js';
import * as service from './auth.service.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

const getCookieOptions = (): import('express').CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const result = await service.login(loginSchema.parse(req.body));
    res.cookie('token', result.accessToken, getCookieOptions());
    successResponse(res, { user: result.user }, 'Logged in');
  })
);

authRouter.post('/logout', (_req, res) => {
  const { maxAge, expires, ...clearOptions } = getCookieOptions();
  res.clearCookie('token', clearOptions);
  successResponse(res, null, 'Logged out');
});

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user?.id) throw AppError.unauthorized();
    successResponse(res, await service.me(req.user.id), 'Current user profile');
  })
);

authRouter.post(
  '/register',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await service.register(registerSchema.parse(req.body));
    res.cookie('token', result.accessToken, getCookieOptions());
    successResponse(res, { user: result.user }, 'Registered', 201);
  })
);
