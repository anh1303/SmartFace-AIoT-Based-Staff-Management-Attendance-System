import { workDateSchema } from '../../common/date.schema.js'
import { z } from 'zod'
import { ATTENDANCE_METHOD } from '../../common/constants.js'

export const checkInSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
  event_id: z.string().uuid().optional(),
  method: z.enum([
    ATTENDANCE_METHOD.FACE,
    ATTENDANCE_METHOD.FINGERPRINT,
    ATTENDANCE_METHOD.MANUAL,
    ATTENDANCE_METHOD.CARD,
  ]).optional(),
})

export const adjustAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: workDateSchema,
  reason: z.string().trim().min(3).max(2000),
  late_early: z.number().finite().min(0).max(744).default(0),
  overtime: z.number().finite().min(0).max(744).default(0),
})

export const checkOutSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
  event_id: z.string().uuid().optional(),
})

export const aggregateAttendanceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  employeeId: z.string().optional(),
})

export type CheckInDto = z.infer<typeof checkInSchema>
export type AdjustAttendanceDto = z.infer<typeof adjustAttendanceSchema>
export type CheckOutDto = z.infer<typeof checkOutSchema>
export type AggregateAttendanceDto = z.infer<typeof aggregateAttendanceSchema>

