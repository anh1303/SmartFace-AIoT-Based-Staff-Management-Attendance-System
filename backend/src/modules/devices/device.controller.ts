import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import * as service from './device.service.js'
import { emitDeviceEvent } from '../../sockets/device.gateway.js'

const deviceSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  ip: z.string().ip().nullable().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).optional(),
})

export const deviceRouter = Router()
deviceRouter.use(authenticate)

deviceRouter.get('/', async (_req, res, next) => {
  try {
    successResponse(res, await service.list())
  } catch (e) {
    next(e)
  }
})

deviceRouter.get('/:id', async (req, res, next) => {
  try {
    successResponse(res, await service.get(req.params.id))
  } catch (e) {
    next(e)
  }
})

deviceRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const device = await service.create(deviceSchema.parse(req.body))
    emitDeviceEvent('created', device)
    successResponse(res, device, 'Device created', 201)
  } catch (e) {
    next(e)
  }
})

deviceRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const device = await service.update(String(req.params.id), deviceSchema.partial().parse(req.body))
    emitDeviceEvent('updated', device)
    successResponse(res, device, 'Device updated')
  } catch (e) {
    next(e)
  }
})

deviceRouter.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    await service.remove(String(req.params.id))
    successResponse(res, null, 'Device deleted')
  } catch (e) {
    next(e)
  }
})