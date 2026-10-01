import { z } from 'zod'

export const registerBiometricSchema = z.object({
  employeeId: z.string().optional(),
  embedding: z.array(z.number()).min(64).max(1024),
  model_version: z.string().optional(),
  sample_tag: z.string().optional(),
  quality_score: z.number().min(0).max(1).optional(),
})

export type RegisterBiometricDto = z.infer<typeof registerBiometricSchema>

export const enrollImagesSchema = z.object({
  images: z.array(z.string().min(50, 'Mỗi ảnh base64 tối thiểu 50 ký tự')).min(1, 'Cần tối thiểu 1 ảnh').max(10, 'Tối đa 10 ảnh'),
})

export type EnrollImagesDto = z.infer<typeof enrollImagesSchema>
