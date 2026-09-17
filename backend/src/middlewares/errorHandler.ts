import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../common/AppError.js'
import { errorResponse } from '../common/response.js'
export const notFound: RequestHandler = (req, _res, next) => next(new AppError(404, `Route ${req.method} ${req.originalUrl} was not found`))
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const fieldMsgs = Object.entries(error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs || []).join(', ')}`)
      .join('; ')
    const msg = fieldMsgs ? `Dữ liệu nhập không hợp lệ (${fieldMsgs})` : 'Dữ liệu nhập không hợp lệ'
    return errorResponse(res, msg, 422, error.flatten())
  }
  if (error instanceof AppError) return errorResponse(res, error.message, error.statusCode, error.details)
  if ((error as { code?: string }).code === 'P2002') return errorResponse(res, 'Mã hoặc Email đã tồn tại trong CSDL', 409)
  if ((error as { code?: string }).code === '22003' || (error as { code?: string }).code === 'P2020') {
    return errorResponse(res, 'Gia tri so vuot qua gioi han cho phép (Numeric overflow)', 400)
  }
  console.error(error)
  return errorResponse(res, 'Internal server error', 500)
}
