import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../../config/env.js'
import { AppError } from '../../../common/AppError.js'
import { successResponse } from '../../../common/response.js'
import { authenticate } from '../../../middlewares/auth.middleware.js'
import { asyncHandler } from '../../../middlewares/asyncHandler.js'
import { getCookieOptions } from '../auth.controller.js'
import { passwordSession } from '../auth.service.js'
import {
  FACE_LOGIN_BINDING_COOKIE,
} from './face-login.cookies.js'
import {
  attemptStatus,
  cancelAttempt,
  completeAttempt,
  dropCompletedFaceLoginRecovery,
  faceLoginConfigured,
  processAttemptFrame,
  startAttempt,
} from './face-login.service.js'

export const faceLoginRouter = Router()
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng chờ một phút.', code: 'IP_RATE_LIMIT' },
})
const frameLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng chờ một phút.', code: 'IP_RATE_LIMIT' },
})
const controlLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng chờ một phút.', code: 'IP_RATE_LIMIT' },
})
const passwordLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => req.user!.id, message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng thử lại sau.', code: 'IP_RATE_LIMIT' } })
const bindingCookie = FACE_LOGIN_BINDING_COOKIE
const attemptId = z.string().regex(/^[a-f0-9]{32}$/)
export const frameBody = z.object({
  seq: z.number().int().min(1).max(75),
  frame: z
    .string()
    .min(4)
    .max(273068)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine(val => val.length % 4 === 0, { message: 'Invalid Base64 length' })
    .refine(val => {
      const buf = Buffer.from(val, 'base64')
      return buf.length >= 1 && buf.toString('base64') === val
    }, { message: 'Non-canonical Base64' }),
}).strict()
export const emptyBody = z.object({}).strict()

faceLoginRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
faceLoginRouter.get('/config', (_req, res) => successResponse(res, { enabled: faceLoginConfigured() }))
faceLoginRouter.post('/password-session', authenticate, passwordLimiter, asyncHandler(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).strict().parse(req.body)
  const result = await passwordSession(req.user!.id, password)
  dropCompletedFaceLoginRecovery(req.cookies?.[bindingCookie])
  res.cookie('token', result.accessToken, getCookieOptions(false))
  successResponse(res, { user: result.user })
}))
faceLoginRouter.use((req, _res, next) => {
  if (!faceLoginConfigured()) return next(new AppError(503, 'Đăng nhập khuôn mặt chưa được bật. Vui lòng dùng mật khẩu.'))
  if (req.method !== 'GET') {
    const origin = req.get('origin')
    if (!origin || !env.CORS_ORIGIN.split(',').map(value => value.trim()).includes(origin)) return next(AppError.forbidden())
  }
  next()
})

faceLoginRouter.post('/attempts', limiter, asyncHandler(async (req, res) => {
  emptyBody.parse(req.body ?? {})
  const existing = req.cookies?.[bindingCookie]
  const binding = typeof existing === 'string' && /^[a-f0-9]{32}$/.test(existing) ? existing : randomBytes(16).toString('hex')
  const result = await startAttempt(binding)
  res.cookie(bindingCookie, binding, { ...getCookieOptions(false), maxAge: 60_000 })
  successResponse(res, result)
}))
faceLoginRouter.post('/attempts/:id/frames', frameLimiter, asyncHandler(async (req, res) => {
  const id = attemptId.parse(req.params.id)
  const body = frameBody.parse(req.body)
  const decodedLength = Buffer.from(body.frame, 'base64').length
  if (decodedLength < 1 || decodedLength > 200 * 1024) throw new AppError(413, 'Ảnh camera quá lớn.')
  successResponse(res, await processAttemptFrame(id, req.cookies?.[bindingCookie], body.seq, body.frame))
}))
faceLoginRouter.post('/attempts/:id/complete', controlLimiter, asyncHandler(async (req, res) => {
  emptyBody.parse(req.body ?? {})
  const result = await completeAttempt(attemptId.parse(req.params.id), req.cookies?.[bindingCookie])
  res.cookie('token', result.accessToken, getCookieOptions(false))
  // Keep face_login_attempt binding cookie intact (do not clear or renew TTL) so bounded status/complete recovery works.
  successResponse(res, { user: result.user }, 'Đã đăng nhập')
}))
faceLoginRouter.post('/attempts/:id/cancel', controlLimiter, (req, res) => {
  emptyBody.parse(req.body ?? {})
  cancelAttempt(attemptId.parse(req.params.id), req.cookies?.[bindingCookie])
  successResponse(res, { state: 'cancelled' })
})
faceLoginRouter.get('/attempts/:id', controlLimiter, (req, res) => {
  successResponse(res, attemptStatus(attemptId.parse(req.params.id), req.cookies?.[bindingCookie]))
})
