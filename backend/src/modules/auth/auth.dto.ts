import { z } from 'zod'

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    identifier: z.string().min(1).optional(),
    password: z.string().min(6),
  })
  .refine((v) => v.email || v.identifier, { message: 'email or identifier is required' })

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
  departmentId: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
  department_id: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
  position: z.string().min(2).default('Employee'),
})
