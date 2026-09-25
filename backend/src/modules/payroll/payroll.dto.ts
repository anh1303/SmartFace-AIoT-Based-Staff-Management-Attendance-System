import { z } from 'zod'
import { PAYROLL_STATUS } from '../../common/constants.js'

export const updateBonusPenaltySchema = z.object({
  overtime_rate: z.number().optional(),
  late_early_penalty: z.number().optional(),
  description: z.string().optional(),
})

export const generatePayrollSchema = z
  .object({
    payroll_period: z.string().optional(),
    period: z.string().optional(),
    employeeId: z.string().optional(),
  })
  .refine(
    (data) => {
      const p = data.payroll_period || data.period
      return Boolean(p && /^\d{4}-\d{2}$/.test(p))
    },
    { message: 'Format payroll_period/period phải là YYYY-MM' },
  )

export const updatePayrollSchema = z.object({
  hourly_rate: z.number().optional(),
  allowance: z.number().optional(),
  total_working_hours: z.number().optional(),
  working_hours: z.number().optional(),
  total_overtime: z.number().optional(),
  total_late_early: z.number().optional(),
  status: z
    .enum([
      PAYROLL_STATUS.PENDING,
      PAYROLL_STATUS.FINALIZED,
      PAYROLL_STATUS.CONFIRMED,
      PAYROLL_STATUS.PAID,
    ])
    .optional(),
})

export type UpdateBonusPenaltyDto = z.infer<typeof updateBonusPenaltySchema>
export type GeneratePayrollDto = z.infer<typeof generatePayrollSchema>
export type UpdatePayrollDto = z.infer<typeof updatePayrollSchema>
