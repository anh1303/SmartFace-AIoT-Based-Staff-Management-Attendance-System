import { z } from 'zod'
import { workDateSchema } from '../../common/date.schema.js'
const multiplierSchema = z.number().finite().min(0).max(50).multipleOf(0.0001)
export const updateBonusPenaltySchema = z.object({
  overtime_rate: multiplierSchema.optional(),
  late_early_penalty: multiplierSchema.optional(),
  absence_penalty_rate: multiplierSchema.optional(),
  effective_period: z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/).optional(),
  description: z.string().max(255).optional(),
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
  reason: z.string().trim().min(1).max(2000).optional(),
  updated_at: z.string().datetime().optional(),
  allowance: z.number().finite().min(0).max(1000000000000),
}).strict()

export type UpdateBonusPenaltyDto = z.infer<typeof updateBonusPenaltySchema>
export type GeneratePayrollDto = z.infer<typeof generatePayrollSchema>
export type UpdatePayrollDto = z.infer<typeof updatePayrollSchema>

export const reviewAdjustmentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(2000).optional(),
  updated_at: z.string().datetime(),
})

export const earlySettlementSchema = z.object({
  employeeId: z.string().min(1, 'Mã nhân viên là bắt buộc'),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ lương phải có dạng YYYY-MM'),
  cutoffDate: workDateSchema,
  reason: z.string().trim().min(1, 'Lý do quyết toán sớm là bắt buộc').max(2000),
})

export type EarlySettlementDto = z.infer<typeof earlySettlementSchema>
