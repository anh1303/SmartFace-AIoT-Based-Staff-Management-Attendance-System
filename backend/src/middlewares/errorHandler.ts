import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../common/AppError.js'
import { errorResponse } from '../common/response.js'

export const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} was not found`))

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const fieldMsgs = Object.entries(error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs || []).join(', ')}`)
      .join('; ')
    const msg = fieldMsgs ? `Dữ liệu nhập không hợp lệ (${fieldMsgs})` : 'Dữ liệu nhập không hợp lệ'
    return errorResponse(res, msg, 422, error.flatten())
  }

  if (error instanceof AppError) {
    return errorResponse(res, error.message, error.statusCode, error.details)
  }

  const err = error as { code?: string; meta?: Record<string, unknown> }

  if (err.code === 'P2002') {
    const target = err.meta?.target
    const fieldMsg = Array.isArray(target) ? ` (${target.join(', ')})` : ''
    return errorResponse(res, `Mã hoặc Email đã tồn tại trong CSDL${fieldMsg}`, 409)
  }

  if (err.code === '22003' || err.code === 'P2020') {
    const details =
      err.meta?.details || err.meta?.cause || (Array.isArray(err.meta?.target) ? err.meta?.target.join(', ') : undefined)
    const extra = details ? ` (${details})` : ''
    return errorResponse(res, `Giá trị vượt quá giới hạn cho phép${extra}`, 400)
  }

  console.error(error)
  return errorResponse(res, 'Internal server error', 500)
}

