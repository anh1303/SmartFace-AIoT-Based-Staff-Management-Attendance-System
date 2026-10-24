import type { Request } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { AppError } from './AppError.js'

/** Only the trusted ThingsBoard REST node may call device webhooks. */
export function assertDeviceWebhook(req: Request) {
  const secret = process.env.TB_WEBHOOK_SECRET
  if (!secret || secret.length < 24) throw new AppError(503, 'Chưa cấu hình TB_WEBHOOK_SECRET (ít nhất 24 ký tự)')
  const supplied = req.header('X-TB-Webhook-Secret') || ''
  const expected = Buffer.from(secret), actual = Buffer.from(supplied)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw AppError.unauthorized('Device webhook authentication failed')
}
