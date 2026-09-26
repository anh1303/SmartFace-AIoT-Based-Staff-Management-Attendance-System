import type { Response } from 'express'

// 9. Chuyển đổi BigInt thành string để JSON.stringify không bị lỗi,
// đồng thời xử lý an toàn Map, Set, Buffer và chống stack overflow do circular reference
function serializeBigInt(data: unknown, seen = new WeakSet<object>()): unknown {
  if (data === null || data === undefined) return data
  if (typeof data === 'bigint') return data.toString()
  if (typeof data !== 'object') return data

  if (data instanceof Date) return data
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data.toString('base64')

  // Phòng tránh đệ quy vô hạn theo nhánh (Ancestor Tracking với Backtracking)
  if (seen.has(data)) return '[Circular]'
  seen.add(data)

  try {
    // Hỗ trợ Map
    if (data instanceof Map) {
      const obj: Record<string, unknown> = {}
      for (const [k, v] of data.entries()) {
        obj[String(k)] = serializeBigInt(v, seen)
      }
      return obj
    }

    // Hỗ trợ Set
    if (data instanceof Set) {
      return Array.from(data).map((v) => serializeBigInt(v, seen))
    }

    // Hỗ trợ Array
    if (Array.isArray(data)) {
      return data.map((v) => serializeBigInt(v, seen))
    }

    // Hỗ trợ Object thông thường
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serializeBigInt(value, seen)
    }
    return result
  } finally {
    seen.delete(data)
  }
}

export const successResponse = <T>(res: Response, data: T, message?: string, status = 200) =>
  res.status(status).json({
    success: true,
    data: serializeBigInt(data),
    ...(message ? { message } : {}),
  })

export const errorResponse = (res: Response, message: string, status = 400, details?: unknown) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) })