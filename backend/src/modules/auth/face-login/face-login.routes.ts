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
import { ChallengeStore } from './face-login.policy.js'
import { FACE_LOGIN_FAILURE, faceLoginConfigured, loginBody, recognizeLogin } from './face-login.service.js'

export const faceLoginRouter = Router()
const challenges = new ChallengeStore()
const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng chờ một phút.' } })
const passwordLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => req.user!.id, message: { success: false, message: 'Đã thử quá nhiều lần. Vui lòng thử lại sau.' } })
const bindingCookie = 'face_login_attempt'

faceLoginRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
faceLoginRouter.get('/config', (_req, res) => successResponse(res, { enabled: faceLoginConfigured() }))
faceLoginRouter.post('/password-session', authenticate, passwordLimiter, asyncHandler(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).strict().parse(req.body)
  const result = await passwordSession(req.user!.id, password)
  res.cookie('token', result.accessToken, getCookieOptions(false))
  successResponse(res, { user: result.user })
}))
faceLoginRouter.use((req, _res, next) => {
  if (!faceLoginConfigured()) return next(new AppError(503, 'Đăng nhập khuôn mặt chưa được bật. Vui lòng dùng mật khẩu.'))
  const origin = req.get('origin')
  if (!origin || !env.CORS_ORIGIN.split(',').map(value => value.trim()).includes(origin)) return next(AppError.forbidden())
  next()
})
faceLoginRouter.post('/challenges', limiter, (_req, res, next) => {
  const binding = randomBytes(16).toString('hex')
  try {
    const challenge = challenges.create(binding)
    res.cookie(bindingCookie, binding, { ...getCookieOptions(false), maxAge: 60_000 })
    successResponse(res, { challengeId: challenge.id, expiresAt: challenge.expiresAt })
  } catch { next(new AppError(429, 'Hệ thống đang bận. Vui lòng thử lại sau.')) }
})
faceLoginRouter.post('/', limiter, asyncHandler(async (req, res) => {
  const body = loginBody.parse(req.body)
  const challenge = challenges.consume(body.challengeId, req.cookies?.[bindingCookie])
  res.clearCookie(bindingCookie, getCookieOptions(false))
  if (!challenge) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  for (const frame of body.frames) if (Buffer.from(frame, 'base64').length > 200 * 1024) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  const result = await recognizeLogin(body.frames)
  res.cookie('token', result.accessToken, getCookieOptions(false))
  successResponse(res, { user: result.user }, 'Đã đăng nhập')
}))
