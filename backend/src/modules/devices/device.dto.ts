import { z } from 'zod'
import { DEVICE_STATUS } from '../../common/constants.js'

export const createDeviceSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  ip: z.string().ip().nullable().optional(),
  status: z.enum([DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE, DEVICE_STATUS.MAINTENANCE]).optional(),
})

export const updateDeviceSchema = createDeviceSchema.partial()
