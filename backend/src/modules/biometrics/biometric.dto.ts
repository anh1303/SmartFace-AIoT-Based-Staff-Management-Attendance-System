import { z } from 'zod'

export const enrollImagesSchema = z.object({
  images: z.array(z.string().min(50, 'Mỗi ảnh base64 tối thiểu 50 ký tự')).min(1, 'Cần tối thiểu 1 ảnh').max(10, 'Tối đa 10 ảnh'),
})

export type EnrollImagesDto = z.infer<typeof enrollImagesSchema>
