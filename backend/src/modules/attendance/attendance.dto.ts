import { z } from 'zod'
import { ATTENDANCE_METHOD } from '../../common/constants.js'

export const checkInSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
  method: z.enum([
    ATTENDANCE_METHOD.FACE,
    ATTENDANCE_METHOD.FINGERPRINT,
    ATTENDANCE_METHOD.MANUAL,
    ATTENDANCE_METHOD.CARD,
  ]).optional(),
})

export const adjustAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  late_early: z.number().min(0).default(0),
  overtime: z.number().min(0).default(0),
})

export const checkOutSchema = z.object({
  employeeId: z.string().min(1),
  device_info: z.string().optional(),
})

export type CheckInDto = z.infer<typeof checkInSchema>
export type AdjustAttendanceDto = z.infer<typeof adjustAttendanceSchema>
export type CheckOutDto = z.infer<typeof checkOutSchema>

