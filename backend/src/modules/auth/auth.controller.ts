import { Request, Response } from 'express';
import { successResponse } from '../../common/response.js';
import { AppError } from '../../common/AppError.js';
import { loginSchema, registerSchema } from './auth.dto.js';
import * as service from './auth.service.js';
import { env } from '../../config/env.js';

export const getCookieOptions = (rememberMe = false): import('express').CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  // Mặc định KHÔNG đặt maxAge -> Session Cookie (trình duyệt tự xóa khi đóng)
  // Chỉ khi người dùng chủ động chọn "Ghi nhớ phiên đăng nhập" mới lưu dài hạn
  ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
});

export const login = async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const result = await service.login(body);
  res.cookie('token', result.accessToken, getCookieOptions(Boolean(body.rememberMe)));
  successResponse(res, { user: result.user }, 'Logged in');
};

export const logout = (_req: Request, res: Response) => {
  const { maxAge, expires, ...clearOptions } = getCookieOptions(false);
  res.clearCookie('token', clearOptions);
  successResponse(res, null, 'Logged out');
};

export const me = async (req: Request, res: Response) => {
  if (!req.user?.id) throw AppError.unauthorized();
  successResponse(res, await service.me(req.user.id), 'Current user profile');
};

export const register = async (req: Request, res: Response) => {
  const result = await service.register(registerSchema.parse(req.body));
  res.cookie('token', result.accessToken, getCookieOptions());
  successResponse(res, { user: result.user }, 'Registered', 201);
};
