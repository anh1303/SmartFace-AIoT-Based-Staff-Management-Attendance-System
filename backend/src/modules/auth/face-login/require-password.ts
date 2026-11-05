import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../../common/AppError.js'

export function requirePasswordAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.amr?.includes('pwd')) return next(new AppError(403,
    'Vui lòng xác thực lại bằng mật khẩu để thực hiện thao tác này.', undefined, 'PASSWORD_REQUIRED'))
  next()
}
