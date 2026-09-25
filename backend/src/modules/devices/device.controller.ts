import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorize } from '../../middlewares/rbac.middleware.js'
import { successResponse } from '../../common/response.js'
import * as service from './device.service.js'
import { emitDeviceEvent } from '../../sockets/device.gateway.js'
import { createDeviceSchema, updateDeviceSchema } from './device.dto.js'

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
    const device = await service.create(createDeviceSchema.parse(req.body), req.user?.id)
    emitDeviceEvent('created', device)
    successResponse(res, device, 'Device created', 201)
  } catch (e) {
    next(e)
  }
})

deviceRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const device = await service.update(String(req.params.id), updateDeviceSchema.parse(req.body), req.user?.id)
    emitDeviceEvent('updated', device)
    successResponse(res, device, 'Device updated')
  } catch (e) {
    next(e)
  }
})

deviceRouter.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    await service.remove(String(req.params.id), req.user?.id)
    successResponse(res, null, 'Device deleted')
  } catch (e) {
    next(e)
  }
})