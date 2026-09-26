import { z } from 'zod'
import { EMPLOYEE_STATUS } from '../../common/constants.js'

export const createEmployeeSchema = z.object({
  employee_code: z.string().optional(),
  employee_id: z.string().optional(),
  full_name: z.string().min(1, 'Họ và tên không được để trống'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')).nullable(),
  position: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.number().int().positive().nullable().optional(),
  department_id: z.number().int().positive().nullable().optional(),
  department: z.string().optional().nullable(),
  status: z.enum([EMPLOYEE_STATUS.ACTIVE, EMPLOYEE_STATUS.INACTIVE, EMPLOYEE_STATUS.TERMINATED]).optional(),
  hourly_rate: z.number().nonnegative().max(999999999999, 'Lương giờ tối đa 999 tỷ').optional(),
  avatar: z.string().optional().nullable(),
  avatar_url: z.string().optional().nullable(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>

