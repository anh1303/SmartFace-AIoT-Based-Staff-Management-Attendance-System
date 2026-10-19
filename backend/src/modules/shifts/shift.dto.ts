import { z } from 'zod'

export const VALID_SHIFT_TYPES = ['OFFICE_HOURS', 'MORNING', 'AFTERNOON', 'OFF'] as const

export const assignShiftSchema = z
  .object({
    employee_id: z.string().optional(),
    employeeId: z.string().optional(),
    date: z.string().optional(),
    work_date: z.string().optional(),
    work_day: z.string().optional(),
    shift_type: z.enum([
      'OFFICE_HOURS',
      'MORNING',
      'AFTERNOON',
      'OFF',
      'office_hours',
      'morning',
      'afternoon',
      'off',
    ]),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    note: z.string().optional(),
  })
  .refine((d) => Boolean(d.employee_id || d.employeeId), {
    message: 'employee_id hoặc employeeId là bắt buộc',
  })
  .refine((d) => Boolean(d.date || d.work_date), {
    message: 'date hoặc work_date là bắt buộc',
  })

export type AssignShiftDto = z.infer<typeof assignShiftSchema>

