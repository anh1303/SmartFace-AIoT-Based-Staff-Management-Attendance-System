import { workDateSchema } from '../../common/date.schema.js'
import { z } from 'zod'
import { ATTENDANCE_METHOD } from '../../common/constants.js'

export const checkInSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
  event_id: z.string().uuid().optional(),
  method: z.enum([
    ATTENDANCE_METHOD.MANUAL,
    ATTENDANCE_METHOD.FINGERPRINT,
    ATTENDANCE_METHOD.CARD,
  ]).optional().default(ATTENDANCE_METHOD.MANUAL),
  reason: z.string().trim().max(1000).optional(),
})

export const adjustAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: workDateSchema,
  reason: z.string().trim().min(1, 'Lý do điều chỉnh là bắt buộc').max(2000),
  late_early: z.number().finite().min(0).max(744).default(0),
  overtime: z.number().finite().min(0).max(744).default(0),
})

export const checkOutSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
  event_id: z.string().uuid().optional(),
  method: z.enum([
    ATTENDANCE_METHOD.MANUAL,
    ATTENDANCE_METHOD.FINGERPRINT,
    ATTENDANCE_METHOD.CARD,
  ]).optional().default(ATTENDANCE_METHOD.MANUAL),
  reason: z.string().trim().max(1000).optional(),
})

export const aggregateAttendanceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  employeeId: z.string().optional(),
})

export const devSimulateFaceScanSchema = z.object({
  employeeId: z.string().min(1),
  mode: z.enum(['CHECK_IN', 'CHECK_OUT']).default('CHECK_IN'),
  device_id: z.string().optional().default('DEV_SIMULATOR'),
  antispoof_score: z.number().min(0).max(1).optional().default(0.95),
  verification_score: z.number().min(0).max(1).optional().default(0.92),
})

export type CheckInDto = z.infer<typeof checkInSchema>
export type AdjustAttendanceDto = z.infer<typeof adjustAttendanceSchema>
export type CheckOutDto = z.infer<typeof checkOutSchema>
export type AggregateAttendanceDto = z.infer<typeof aggregateAttendanceSchema>
export type DevSimulateFaceScanInput = z.input<typeof devSimulateFaceScanSchema>
export type DevSimulateFaceScanDto = z.infer<typeof devSimulateFaceScanSchema>

