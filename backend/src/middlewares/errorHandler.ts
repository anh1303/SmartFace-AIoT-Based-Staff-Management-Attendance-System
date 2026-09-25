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

  const prismaCode = (error as { code?: string }).code
  if (prismaCode === 'P2000') {
    return errorResponse(res, 'Giá trị nhập vào vượt quá độ dài tối đa cho phép', 400)
  }
  if (prismaCode === 'P2002') {
    return errorResponse(res, 'Mã hoặc dữ liệu đã tồn tại trong CSDL (Duplicate entry)', 409)
  }
  if (prismaCode === 'P2003') {
    return errorResponse(res, 'Dữ liệu liên kết không hợp lệ (Foreign key constraint failed)', 400)
  }
  if (prismaCode === 'P2011') {
    return errorResponse(res, 'Trường bắt buộc không được để trống (Null constraint violation)', 400)
  }
  if (prismaCode === 'P2014') {
    return errorResponse(res, 'Thay đổi vi phạm ràng buộc quan hệ bắt buộc giữa các bản ghi', 400)
  }
  if (prismaCode === 'P2020') {
    return errorResponse(res, 'Giá trị số vượt quá giới hạn cho phép (Numeric overflow)', 400)
  }
  if (prismaCode === 'P2025') {
    return errorResponse(res, 'Không tìm thấy bản ghi tương ứng trong CSDL', 404)
  }

  console.error(error)
  return errorResponse(res, 'Internal server error', 500)
}