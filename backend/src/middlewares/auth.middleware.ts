import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../common/AppError.js'

// role là role_name (string) từ bảng roles: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type AuthUser = { id: string; employeeId?: string | null; role: string; email?: string | null; username: string }

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return next(new AppError(401, 'Authentication token is required'))
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser
    next()
  } catch {
    next(new AppError(401, 'Invalid or expired token'))
  }
}