import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../common/AppError.js'

import { verifyAndLoadActiveUser } from '../modules/auth/public.js'

// role là role_name (string) từ bảng roles: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type AuthUser = {
  id: string
  amr?: string[]
  employeeId?: string | null
  employee_id?: string | null
  role: string
  role_name?: string
  is_manager?: boolean
  email?: string | null
  username: string
  department?: string | null
  departmentId?: number | null
  department_id?: number | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return next(new AppError(401, 'Authentication token is required'))
  try {
    req.user = await verifyAndLoadActiveUser(token)
    next()
  } catch (err: any) {
    res.clearCookie('token', { path: '/' })
    if (err instanceof AppError) {
      return next(err)
    }
    next(new AppError(401, 'Invalid or expired token'))
  }
}
