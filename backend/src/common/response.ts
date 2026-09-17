import type { Response } from 'express'

// Chuyển đổi BigInt thành string để JSON.stringify không bị lỗi
// (Prisma trả BigInt cho các field @id @default(autoincrement()) kiểu BIGSERIAL)
function serializeBigInt(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (data instanceof Date) return data
  if (typeof data === 'bigint') return data.toString()
  if (Array.isArray(data)) return data.map(serializeBigInt)
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serializeBigInt(value)
    }
    return result
  }
  return data
}

export const successResponse = <T>(res: Response, data: T, message?: string, status = 200) =>
  res.status(status).json({
    success: true,
    data: serializeBigInt(data),
    ...(message ? { message } : {}),
  })

export const errorResponse = (res: Response, message: string, status = 400, details?: unknown) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) })
