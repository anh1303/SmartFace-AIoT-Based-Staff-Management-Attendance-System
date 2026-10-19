import { z } from 'zod'
import { PAYROLL_STATUS } from '../../common/constants.js'

export const updateBonusPenaltySchema = z.object({
  overtime_rate: z.number().finite().min(0).max(99999999.99).optional(),
  late_early_penalty: z.number().finite().min(0).max(1000000000).optional(),
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
      return Boolean(p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p))
    },
    { message: 'Format payroll_period/period phải là YYYY-MM' },
  )

export const updatePayrollSchema = z.object({
  reason: z.string().trim().min(3).max(2000).optional(),
  hourly_rate: z.number().finite().min(0).max(1000000000).optional(),
  allowance: z.number().finite().min(0).max(1000000000000).optional(),
  total_working_hours: z.number().finite().min(0).max(744).optional(),
  working_hours: z.number().finite().min(0).max(744).optional(),
  total_overtime: z.number().finite().min(0).max(744).optional(),
  total_late_early: z.number().finite().min(0).max(744).optional(),
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
