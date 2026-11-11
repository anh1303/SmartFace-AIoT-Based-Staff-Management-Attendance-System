import { createHash } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { asyncHandler } from '../../middlewares/asyncHandler.js'
import { AppError } from '../../common/AppError.js'
import { traceAttendance } from '../../common/attendance-timing.js'
import { authenticateFingerprintDevice } from '../biometrics/fingerprint.routes.js'
import { findAttendanceLogByEventKey, handleThingsBoardWebhook } from './attendance.service.js'
import { compactAttendanceRpcResponse } from './attendance.rpc-response.js'

export const deviceAttendanceRouter = Router({ mergeParams: true })
deviceAttendanceRouter.use(asyncHandler(authenticateFingerprintDevice))
deviceAttendanceRouter.use(rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: req => String(req.params.id), standardHeaders: 'draft-8', legacyHeaders: false }))
deviceAttendanceRouter.post('/', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const body = req.body
  if (!body || body.device_id !== req.params.id) throw AppError.forbidden('Device identity mismatch')
  if (!['VERIFY_ONLY', 'CONFIRMED_SCAN', 'FINGERPRINT_SCAN'].includes(body.event_kind)) throw AppError.badRequest('Invalid attendance event kind')
  const result = await traceAttendance(body.event_id, () => handleThingsBoardWebhook(body))
  res.json(compactAttendanceRpcResponse(result))
}))

// An authenticated device can resolve an ambiguous write without repeating
// biometric matching or granting gate access after the original scan.
deviceAttendanceRouter.get('/status/:eventId', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const { id, eventId } = req.params
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(eventId)) throw AppError.badRequest('Invalid attendance event ID')
  const key = createHash('sha256').update(`${id}:${eventId}`).digest('hex')
  const record = await findAttendanceLogByEventKey(key)
  res.json({
    event_id: eventId,
    recorded: Boolean(record),
    status: record?.status,
    mode: record?.type,
  })
}))
