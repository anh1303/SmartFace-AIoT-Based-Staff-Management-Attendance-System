import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { USER_ROLES, EMPLOYEE_STATUS } from '../../common/constants.js'
import type { z } from 'zod'
import type { loginSchema, registerSchema } from './auth.dto.js'

function safeUser(user: {
  id: string
  username: string
  roles: { role_name: string }
  employees: {
    id: string
    employee_code: string
    full_name: string
    email: string | null
    position: string | null
    avatar_url: string | null
    department: { name: string } | null
  } | null
}) {
  const roleName = user.roles.role_name.toUpperCase()
  const frontendRole: 'manager' | 'employee' =
<<<<<<< Updated upstream
    roleName === USER_ROLES.ADMIN || roleName === USER_ROLES.MANAGER ? 'manager' : 'employee'
=======
    roleName === 'ADMIN' || roleName === 'MANAGER' ? 'manager' : 'employee'
>>>>>>> Stashed changes

  const emp = user.employees

  return {
    id: user.id,
    username: user.username,
    role: frontendRole,
    role_name: user.roles.role_name,
    employee_id: emp?.employee_code || user.id,
    full_name: emp?.full_name || user.username,
    email: emp?.email || '',
    position: emp?.position || '',
    department: emp?.department?.name || '',
    avatar: emp?.avatar_url || '',
  }
}

const tokenFor = (user: ReturnType<typeof safeUser>) =>
  jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

export async function login(input: z.infer<typeof loginSchema>) {
  const identifier = (input.identifier ?? input.email ?? '').trim()

  if (!identifier) {
    throw new AppError(400, 'Username, email or employee ID is required')
  }

  // Tìm user theo username HOẶC thông qua employee (email, employee_code)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: 'insensitive' } },
        {
          employees: {
            OR: [
              { email: { equals: identifier, mode: 'insensitive' } },
              { employee_code: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        },
      ],
    },
    include: {
      roles: true,
      employees: {
        include: {
          department: true,
        },
      },
    },
  })

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid username/email or password')
  }

<<<<<<< Updated upstream
  if (!user.is_active || (user.employees && user.employees.status === EMPLOYEE_STATUS.INACTIVE)) {
=======
  if (!user.is_active || (user.employees && user.employees.status === 'INACTIVE')) {
>>>>>>> Stashed changes
    throw new AppError(403, 'Tài khoản nhân viên đang ở trạng thái TẠM NGƯNG, không thể đăng nhập vào hệ thống!')
  }

  const safe = safeUser(user)
  return { user: safe, accessToken: tokenFor(safe) }
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existingUser = await prisma.user.findFirst({ where: { username: input.username } })
  if (existingUser) throw new AppError(409, 'Username already registered')

  const existingEmployee = await prisma.employee.findFirst({ where: { email: input.email } })
  if (existingEmployee) throw new AppError(409, 'Email already registered')

  const roleRecord = await prisma.roles.findFirst({ where: { role_name: input.role } })
  if (!roleRecord) throw new AppError(400, `Role '${input.role}' not found`)

  if (input.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } })
    if (!dept) throw new AppError(400, `Department ID ${input.departmentId} not found`)
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        employee_code: `EMP-${Date.now()}`,
        full_name: input.name,
        email: input.email,
        position: input.position ?? null,
        departmentId: input.departmentId ?? null,
      },
    })

    const user = await tx.user.create({
      data: {
        username: input.username,
        passwordHash: await bcrypt.hash(input.password, 12),
        role_id: roleRecord.id,
        employees: { connect: { id: employee.id } },
      },
      include: {
        roles: true,
        employees: {
          include: {
            department: true,
          },
        },
      },
    })

    const safe = safeUser(user)
    return { user: safe, accessToken: tokenFor(safe) }
  })
}
