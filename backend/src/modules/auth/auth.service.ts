import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { USER_ROLES } from '../../common/constants.js'
import { generateUniqueEmployeeCode } from '../../common/utils.js'
import { logAction } from '../audit-logs/audit.service.js'
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
  const isManager = roleName === 'ADMIN' || roleName === 'MANAGER'
  const emp = user.employees

  return {
    id: user.id,
    username: user.username,
    role: roleName, // 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
    role_name: roleName,
    is_manager: isManager,
    employee_id: emp?.employee_code || user.id,
    employeeId: emp?.employee_code || user.id,
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

  if (!user.is_active) {
    throw new AppError(403, 'Tài khoản người dùng đã bị vô hiệu hóa, không thể đăng nhập vào hệ thống!')
  }

  if (user.employees) {
    if (user.employees.status === 'TERMINATED') {
      throw new AppError(403, 'Tài khoản nhân viên ĐÃ NGHỈ VIỆC (TERMINATED), không thể đăng nhập vào hệ thống!')
    }
    if (user.employees.status === 'INACTIVE') {
      throw new AppError(403, 'Tài khoản nhân viên đang ở trạng thái TẠM NGƯNG (INACTIVE), không thể đăng nhập vào hệ thống!')
    }
  }

  const safe = safeUser(user)
  return { user: safe, accessToken: tokenFor(safe) }
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      employees: {
        include: {
          department: true,
        },
      },
    },
  })
  if (!user) {
    throw new AppError(404, 'User not found')
  }
  return safeUser(user)
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existingUser = await prisma.user.findFirst({ where: { username: input.username } })
  if (existingUser) throw new AppError(409, 'Username already registered')

  const existingEmployee = await prisma.employee.findFirst({ where: { email: input.email } })
  if (existingEmployee) throw new AppError(409, 'Email already registered')

  // 1. Validate role with constants & database
  if (!Object.values(USER_ROLES).includes(input.role as typeof USER_ROLES[keyof typeof USER_ROLES])) {
    throw new AppError(400, `Vai trò '${input.role}' không hợp lệ. Cho phép: ${Object.values(USER_ROLES).join(', ')}`)
  }
  const roleRecord = await prisma.roles.findFirst({ where: { role_name: { equals: input.role, mode: 'insensitive' } } })
  if (!roleRecord) throw new AppError(400, `Vai trò '${input.role}' không tồn tại trong hệ thống`)

  // 2. Resolve departmentId
  const rawDeptId = input.departmentId ?? input.department_id
  let deptId: number | null = null
  if (rawDeptId !== undefined && rawDeptId !== null && rawDeptId !== '') {
    const num = Number(rawDeptId)
    const dept = isNaN(num)
      ? await prisma.department.findFirst({ where: { department_code: { equals: String(rawDeptId), mode: 'insensitive' } } })
      : await prisma.department.findUnique({ where: { id: num } })
    if (!dept) {
      throw new AppError(400, `Chức vụ / Phòng ban '${rawDeptId}' không tồn tại trong hệ thống`)
    }
    deptId = dept.id
  }

  // 3. Generate collision-free unique employee_code
  const finalCode = await generateUniqueEmployeeCode()

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        employee_code: finalCode,
        full_name: input.name,
        email: input.email,
        position: input.position ?? 'Employee',
        departmentId: deptId,
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

    // 4. Ghi audit log khi đăng ký tài khoản thành công
    await logAction({
      userId: user.id,
      action: 'REGISTER_USER',
      target_table: 'users',
      record_id: user.id,
      new_values: {
        username: user.username,
        role: roleRecord.role_name,
        employee_id: employee.id,
        employee_code: employee.employee_code,
        email: employee.email,
        department_id: deptId,
      },
    })

    const safe = safeUser(user)
    return { user: safe, accessToken: tokenFor(safe) }
  })
}