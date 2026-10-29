import { z } from 'zod'
import { workDateSchema } from '../../common/date.schema.js'
import { PAYROLL_STATUS } from '../../common/constants.js'
import { RATE_KINDS } from '../../common/payroll-rates.js'

export const rateKindSchema = z.enum(RATE_KINDS)

export const updateBonusPenaltySchema = z.object({
  overtime_rate: z.number().finite().min(0).max(99999999.99).optional(),
  overtime_rate_kind: rateKindSchema.optional(),
  late_early_penalty: z.number().finite().min(0).max(1000000000).optional(),
  late_early_penalty_kind: rateKindSchema.optional(),
  absence_penalty_rate: z.number().finite().min(0).max(1).optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  for (const [rate, kind] of [['overtime_rate', 'overtime_rate_kind'], ['late_early_penalty', 'late_early_penalty_kind']] as const) {
    if ((data[rate] === undefined) !== (data[kind] === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [kind], message: 'Cần cung cấp đơn giá và đơn vị cùng nhau' })
    }
  }
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
  reconcile_working_hours: z.boolean().optional(),
  reset_working_hours: z.boolean().optional(),
  updated_at: z.string().datetime().optional(),
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
}).refine(data => !(data.reconcile_working_hours && data.reset_working_hours), {
  path: ['reset_working_hours'], message: 'Chỉ chọn đối chiếu hoặc đặt lại giờ công',
})

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
