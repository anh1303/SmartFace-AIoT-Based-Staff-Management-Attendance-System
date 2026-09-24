import { z } from 'zod'
import { USER_ROLES } from '../../common/constants.js'

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    identifier: z.string().min(1).optional(),
    password: z.string().min(8),
  })
  .refine((v) => v.email || v.identifier, { message: 'email or identifier is required' })

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.EMPLOYEE]).default(USER_ROLES.EMPLOYEE),
  departmentId: z.number().int().positive().nullable().optional(),
  position: z.string().min(2).default('Employee'),
})

