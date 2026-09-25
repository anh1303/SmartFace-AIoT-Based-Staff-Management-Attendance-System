import { z } from 'zod'

export const registerBiometricSchema = z.object({
  employeeId: z.string().optional(),
  embedding: z.array(z.number()).min(64).max(1024),
  model_version: z.string().optional(),
  sample_tag: z.string().optional(),
  quality_score: z.number().min(0).max(1).optional(),
})

export type RegisterBiometricDto = z.infer<typeof registerBiometricSchema>

