import { z } from 'zod'

export const assignShiftSchema = z.object({
  employee_id: z.string().min(1),
  date: z.string().min(1),
  work_day: z.string().optional(),
  shift_type: z.string().min(1),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  note: z.string().optional(),
})
