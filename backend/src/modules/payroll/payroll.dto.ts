import { z } from 'zod'
import { PAYROLL_STATUS } from '../../common/constants.js'

export const updateBonusPenaltySchema = z.object({
  overtime_rate: z.number().optional(),
  late_early_penalty: z.number().optional(),
  description: z.string().optional(),
})

export const generatePayrollSchema = z.object({
  payroll_period: z.string().regex(/^\d{4}-\d{2}$/, 'Format phải là YYYY-MM'),
  employeeId: z.string().optional(),
})

export const updatePayrollSchema = z.object({
  hourly_rate: z.number().optional(),
  allowance: z.number().optional(),
  total_overtime: z.number().optional(),
  total_late_early: z.number().optional(),
  net_salary: z.number().optional(),
  status: z.enum([PAYROLL_STATUS.PENDING, PAYROLL_STATUS.FINALIZED]).optional(),
})
