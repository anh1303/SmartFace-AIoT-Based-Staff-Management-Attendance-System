import { timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'

const payloadSchema = z.object({
  request_id: z.string().regex(/^[a-f0-9]{32}$/),
  image_png_b64: z.string().min(44).max(60000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  model_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  model_version: z.string().min(1).max(80),
}).strict()
let inFlight = 0

/** Separate credentials per device; never give a Pi the trusted TB webhook secret. */
export function authenticateFaceExtraction(req: Request, _res: Response, next: NextFunction) {
  if (process.env.REMOTE_RECOGNITION_ENABLED !== 'true') throw new AppError(503, 'Server recognition is disabled')
  let keys: Record<string, string>
  try {
    keys = JSON.parse(process.env.EDGE_RECOGNITION_KEYS || '{}')
    if (!keys || Array.isArray(keys) || typeof keys !== 'object') throw new Error()
  } catch { throw new AppError(503, 'Invalid edge recognition configuration') }
  const expected = Object.hasOwn(keys, req.params.id) ? keys[req.params.id] : undefined
  const supplied = req.header('Authorization')?.replace(/^Bearer /, '') || ''
  if (typeof expected !== 'string' || expected.length < 32) throw AppError.unauthorized('Invalid device credentials')
  const a = Buffer.from(expected), b = Buffer.from(supplied)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw AppError.unauthorized('Invalid device credentials')
  next()
}

export const faceExtractionLimiter = rateLimit({
  windowMs: 60_000, limit: 120, keyGenerator: req => req.params.id,
  standardHeaders: 'draft-8', legacyHeaders: false,
})

export async function extractDeviceFace(req: Request, res: Response) {
  const body = payloadSchema.parse(req.body)
  const key = process.env.FACE_AUTH_INTERNAL_KEY || ''
  if (key.length < 32) throw new AppError(503, 'Server extraction is not configured')
  if (body.model_version !== env.FACE_AUTH_MODEL_VERSION) throw AppError.unprocessable('ArcFace model version mismatch')
  if (inFlight >= 4) throw new AppError(429, 'Recognition is busy; retry with a fresh frame')
  inFlight++
  try {
    // Bound total upstream time; no retries or stale-frame queue in the API.
    const response = await fetch(`${env.FACE_AUTH_URL}/internal/face-embedding`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Face-Auth-Key': key},
      body: JSON.stringify(body), signal: AbortSignal.timeout(2500), redirect: 'error',
    })
    if (!response.ok) throw new AppError([422, 429, 503].includes(response.status) ? response.status : 502, 'ArcFace extraction unavailable or incompatible')
    const data = await response.json() as Record<string, unknown>
    if (data.request_id !== body.request_id || data.model_sha256 !== body.model_sha256 || data.model_version !== body.model_version
        || typeof data.embedding_b64 !== 'string' || !/^[A-Za-z0-9+/]{2731}=$/.test(data.embedding_b64)) {
      throw new AppError(502, 'ArcFace response contract mismatch')
    }
    const bytes = Buffer.from(data.embedding_b64, 'base64')
    let squaredNorm = 0
    for (let i = 0; i < bytes.length; i += 4) squaredNorm += bytes.readFloatLE(i) ** 2
    if (bytes.length !== 2048 || !Number.isFinite(squaredNorm) || Math.abs(squaredNorm - 1) > 0.001) throw new AppError(502, 'Invalid ArcFace vector')
    // Explicit allowlist: no upstream fields or internal credentials escape the gateway.
    res.json({request_id: body.request_id, embedding_b64: data.embedding_b64,
      model_sha256: body.model_sha256, model_version: body.model_version, inference_ms: data.inference_ms})
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(502, 'ArcFace request failed or timed out')
  } finally { inFlight-- }
}
