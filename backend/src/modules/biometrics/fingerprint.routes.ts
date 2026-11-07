import { Router } from 'express'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { asyncHandler } from '../../middlewares/asyncHandler.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { requirePasswordAuth } from '../auth/public.js'
import { successResponse } from '../../common/response.js'
import { AppError } from '../../common/AppError.js'
import { prisma } from '../../config/database.js'
import * as service from './fingerprint.service.js'

const uuid = z.string().uuid()
const idKey = (req: any) => uuid.parse(req.header('Idempotency-Key'))
const deviceName = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/)
export const fingerprintManagementRouter = Router()
fingerprintManagementRouter.use(authenticate, authorize('ADMIN', 'MANAGER'))
fingerprintManagementRouter.get('/fingerprint-devices', asyncHandler(async (_req, res) => {
  successResponse(res, await prisma.fingerprintDevice.findMany({ orderBy: { device_id: 'asc' } }))
}))
fingerprintManagementRouter.patch('/fingerprint-devices/:deviceId', authorize('ADMIN'), requirePasswordAuth, asyncHandler(async (req, res) => {
  const patch = z.object({ polling_fallback: z.boolean().optional(), attendance_enabled: z.boolean().optional(), acceptance_verified: z.literal(true).optional() }).strict().parse(req.body)
  if (patch.attendance_enabled && !patch.acceptance_verified) throw AppError.badRequest('Phải xác nhận đã đạt kiểm thử nghiệm thu trước khi bật điểm danh thật')
  const { acceptance_verified: _, ...data } = patch
  successResponse(res, await prisma.fingerprintDevice.update({ where: { device_id: deviceName.parse(req.params.deviceId) }, data }))
}))
fingerprintManagementRouter.get('/:employeeId/fingerprint', asyncHandler(async (req, res) => {
  successResponse(res, await service.fingerprintStatus(req.user!, req.params.employeeId as string))
}))
fingerprintManagementRouter.post('/:employeeId/fingerprint/sessions', requirePasswordAuth, asyncHandler(async (req, res) => {
  const body = z.object({ device_id: deviceName, finger_name: z.string().trim().min(1).max(80) }).strict().parse(req.body)
  successResponse(res, await service.startFingerprintSession(req.user!, req.params.employeeId as string, body.device_id, body.finger_name, idKey(req)), 'Đã tạo phiên lấy mẫu', 202)
}))
fingerprintManagementRouter.get('/:employeeId/fingerprint/sessions/current', asyncHandler(async (req, res) => {
  successResponse(res, await service.currentFingerprintSession(req.user!, req.params.employeeId as string))
}))
fingerprintManagementRouter.get('/:employeeId/fingerprint/sessions/:sessionId', asyncHandler(async (req, res) => {
  successResponse(res, await service.readFingerprintSession(req.user!, req.params.employeeId as string, uuid.parse(req.params.sessionId)))
}))
fingerprintManagementRouter.post('/:employeeId/fingerprint/sessions/:sessionId/confirm', requirePasswordAuth, asyncHandler(async (req, res) => {
  successResponse(res, await service.confirmFingerprintSession(req.user!, req.params.employeeId as string, uuid.parse(req.params.sessionId), idKey(req)))
}))
fingerprintManagementRouter.post('/:employeeId/fingerprint/sessions/:sessionId/cancel', requirePasswordAuth, asyncHandler(async (req, res) => {
  successResponse(res, await service.cancelFingerprintSession(req.user!, req.params.employeeId as string, uuid.parse(req.params.sessionId)))
}))
fingerprintManagementRouter.delete('/:employeeId/fingerprint', requirePasswordAuth, asyncHandler(async (req, res) => {
  successResponse(res, await service.revokeFingerprint(req.user!, req.params.employeeId as string))
}))

// Independent of REMOTE_RECOGNITION_ENABLED; reuses the per-device credential map.
export function authenticateFingerprintDevice(req: any, _res: any, next: any) {
  let keys: Record<string, string>
  try { keys = JSON.parse(process.env.EDGE_RECOGNITION_KEYS || '{}') } catch { throw new AppError(503, 'Device keys chưa được cấu hình') }
  const id = deviceName.parse(req.params.id)
  const expected = keys && Object.hasOwn(keys, id) ? keys[id] : undefined
  const actual = req.header('Authorization')?.replace(/^Bearer /, '') || ''
  if (typeof expected !== 'string' || expected.length < 32 || Buffer.byteLength(actual) !== Buffer.byteLength(expected)
      || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw AppError.unauthorized('Invalid device credentials')
  next()
}
export const fingerprintDeviceRouter = Router({ mergeParams: true })
fingerprintDeviceRouter.use(asyncHandler(authenticateFingerprintDevice))
fingerprintDeviceRouter.post('/manifest', asyncHandler(async (req, res) => {
  const body = z.object({ capacity: z.number().int().min(1).max(65535), ready: z.boolean(),
    roundtrip_verified: z.boolean(), wak_verified: z.boolean(), error: z.enum(['UART_UNAVAILABLE','WAK_UNVERIFIED','ROUNDTRIP_UNVERIFIED','SENSOR_ERROR']).nullable() }).strict().parse(req.body)
  // Secret templates are only returned to their assigned authenticated device.
  res.setHeader('Cache-Control', 'no-store')
  res.json(await service.fingerprintManifest(req.params.id, body))
}))
fingerprintDeviceRouter.post('/sessions/:sessionId/progress', asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['WAITING_TOUCH_1','LIFT_FINGER','WAITING_TOUCH_2','VERIFIED','FAILED']),
    template_b64: z.string().max(2048).optional(), match_score: z.number().int().min(0).max(65535).optional(),
    error_code: z.enum(['DUPLICATE_FINGER','NO_MATCH','ROUNDTRIP_FAILED','CAPTURE_TIMEOUT','TRANSPORT_ERROR']).optional(),
    roundtrip_verified: z.boolean().optional(), duplicate_binding_id: uuid.nullable().optional() }).strict().parse(req.body)
  res.json(await service.fingerprintProgress(req.params.id, uuid.parse(req.params.sessionId), body))
}))
fingerprintDeviceRouter.post('/bindings/:bindingId/ack', asyncHandler(async (req, res) => {
  const body = z.object({ checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(), revision: z.number().int().positive().optional(),
    deleted: z.boolean().optional(), error: z.literal('SYNC_FAILED').optional() }).strict().parse(req.body)
  res.json(await service.acknowledgeFingerprintBinding(req.params.id, uuid.parse(req.params.bindingId), body))
}))
