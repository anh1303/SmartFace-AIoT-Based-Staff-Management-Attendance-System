import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../common/AppError.js'

export const authorize = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'))

    const userRole = (req.user.role || '').toUpperCase()
    const allowedRoles = roles.map((r) => r.toUpperCase())

    const isAllowed =
      allowedRoles.includes(userRole) ||
      (userRole === 'MANAGER' && allowedRoles.includes('ADMIN')) ||
      (userRole === 'STAFF' && allowedRoles.includes('EMPLOYEE')) ||
      (userRole === 'EMPLOYEE' && allowedRoles.includes('STAFF'))

    if (!isAllowed) return next(new AppError(403, 'Insufficient permissions'))
    next()
  }