import { storedProfile } from './profile.dto.js';
import type { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { USER_ROLES } from '../../common/constants.js'
import { generateUniqueEmployeeCode, findEmployeeByEmail } from '../employees/employee.code.js'
import { createEmployee, findDepartmentByIdOrCode, findPositionByName } from '../employees/public.js'
import { logAction } from '../audit-logs/public.js'
import type { z } from 'zod'
import type { loginSchema, registerSchema } from './auth.dto.js'
import { faceSessionAllowed } from './face-login/face-login.policy.js'
import { hasFaceLoginTemplate } from '../biometrics/public.js'

function safeUser(user: {
  id: string
  profile?: unknown
  username: string
  roles: { role_name: string }
  employees: {
    id: string
    employee_code: string
    full_name: string
    email: string | null
    position?: { name?: string | null; id?: number } | string | null
    positionId?: number | null
    avatar_url: string | null
    department: { name: string } | null
  } | null
}) {
  const roleName = user.roles.role_name.toUpperCase()
  const isManager = roleName === 'ADMIN' || roleName === 'MANAGER'
  const profile = storedProfile(user.profile)
  const emp = user.employees
  const posName = typeof emp?.position === 'string' ? emp.position : emp?.position?.name || ''

  return {
    id: user.id,
    username: user.username,
    role: roleName, // 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
    role_name: roleName,
    is_manager: isManager,
    employee_id: emp?.employee_code || user.id,
    employeeId: emp?.employee_code || user.id,
    full_name: profile.display_name || emp?.full_name || user.username,
    email: emp?.email || '',
    position: posName,
    positionId: emp?.positionId ?? (typeof emp?.position === 'object' ? emp.position?.id : null),
    department: emp?.department?.name || '',
    avatar: profile.avatar !== undefined ? profile.avatar || '' : emp?.avatar_url || '',
  }
}

const tokenFor = (user: ReturnType<typeof safeUser>, tokenVersion: number = 1, method: 'pwd' | 'face' = 'pwd') => {
  // Profile images belong in API responses; embedding them can exceed browser cookie limits.
  const { avatar: _avatar, ...claims } = user
  return jwt.sign({ ...claims, tv: tokenVersion, amr: [method] }, env.JWT_SECRET,
    { expiresIn: method === 'face' ? '30m' : env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })
}

export async function assertFaceSession(amr: unknown, employeeId: string | null | undefined, role: string) {
  if (!faceSessionAllowed(amr, role, env.FACE_LOGIN_ENABLED)
    || (Array.isArray(amr) && amr.includes('face') && (!employeeId || !(await hasFaceLoginTemplate(employeeId))))) {
    throw AppError.unauthorized('Phiên đăng nhập khuôn mặt đã hết hiệu lực. Vui lòng đăng nhập bằng mật khẩu.')
  }
}

export async function createFaceSession(employeeId: string) {
  const user = await prisma.user.findFirst({ where: { employees: { id: employeeId } },
    include: { roles: true, employees: { include: { department: true, position: true } } } })
  const profile = user?.profile && typeof user.profile === 'object' ? user.profile as Record<string, unknown> : {}
  if (!user?.is_active || user.employees?.status !== 'ACTIVE') {
    throw AppError.unauthorized('Không thể xác thực khuôn mặt. Vui lòng thử lại hoặc đăng nhập bằng mật khẩu.')
  }
  await assertFaceSession(['face'], user.employees.id, user.roles.role_name)
  const safe = safeUser(user)
  return { user: safe, accessToken: tokenFor(safe, Number(profile.token_version || 1), 'face') }
}

export async function passwordSession(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId },
    include: { roles: true, employees: { include: { department: true, position: true } } } })
  if (!user?.is_active || !(await bcrypt.compare(password, user.passwordHash))
    || (user.employees && ['INACTIVE', 'TERMINATED'].includes(user.employees.status))) {
    throw AppError.unauthorized('Mật khẩu không đúng hoặc tài khoản không còn hoạt động.')
  }
  const profile = user.profile && typeof user.profile === 'object' ? user.profile as Record<string, unknown> : {}
  const safe = safeUser(user)
  return { user: safe, accessToken: tokenFor(safe, Number(profile.token_version || 1)) }
}

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
          position: true,
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

  const profileData = (user.profile && typeof user.profile === 'object') ? (user.profile as Record<string, unknown>) : {}
  const currentTv = typeof profileData.token_version === 'number' ? profileData.token_version : 1
  const safe = safeUser(user)
  return { user: safe, accessToken: tokenFor(safe, currentTv) }
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

  const existingEmployee = await findEmployeeByEmail(input.email)
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
    const dept = await findDepartmentByIdOrCode(rawDeptId)
    if (!dept) {
      throw new AppError(400, `Chức vụ / Phòng ban '${rawDeptId}' không tồn tại trong hệ thống`)
    }
    deptId = dept.id
  }

  // 3. Resolve positionId if input.position provided
  let posId: number | null = null
  if (input.position) {
    const foundPos = await findPositionByName(input.position)
    if (foundPos) {
      posId = foundPos.id
      if (!deptId) deptId = foundPos.departmentId
    }
  }

  // 4. Generate collision-free unique employee_code
  const finalCode = await generateUniqueEmployeeCode()

  return prisma.$transaction(async (tx) => {
    const employee = await createEmployee({
        employee_code: finalCode,
        full_name: input.name,
        email: input.email,
        positionId: posId,
        departmentId: deptId,
      }, tx)

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
            position: true,
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

/**
 * Public Module API: Tìm User theo username (hỗ trợ transaction)
 */
export async function findAuthUserByUsername(username: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.user.findFirst({ where: { username } })
}

/**
 * Public Module API: Tìm User theo ID (hỗ trợ transaction)
 */
export async function findAuthUserById(
  userId: string,
  options: { includeRoles: true },
  tx?: Prisma.TransactionClient
): Promise<(Prisma.UserGetPayload<{ include: { roles: true } }>) | null>
export async function findAuthUserById(
  userId: string,
  options?: { includeRoles?: boolean },
  tx?: Prisma.TransactionClient
): Promise<(Prisma.UserGetPayload<{ include: { roles?: boolean } }>) | null>
export async function findAuthUserById(
  userId: string,
  options?: { includeRoles?: boolean },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma
  if (options?.includeRoles) {
    return client.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    })
  }
  return client.user.findUnique({ where: { id: userId } })
}

/**
 * Public Module API: Tạo User mới (dành cho module employees khi tạo nhân viên)
 */
export async function createAuthUser(
  data: {
    username: string
    passwordHash: string
    role_id: number
    is_active?: boolean
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma
  return client.user.create({ data })
}

/**
 * Public Module API: Cập nhật thông tin User (hỗ trợ transaction)
 */
export async function updateAuthUser(
  userId: string,
  data: Prisma.UserUpdateInput,
  tx?: Prisma.TransactionClient
) {
  const run = async (t: Prisma.TransactionClient) => {
    if (typeof (t as any).$executeRaw === 'function') {
      await (t as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'user-auth:' + userId}))`
    }
    if (data.passwordHash) {
      const existing = await t.user.findUnique({ where: { id: userId }, select: { profile: true } })
      const p = (existing?.profile && typeof existing.profile === 'object') ? (existing.profile as Record<string, unknown>) : {}
      const tv = (typeof p.token_version === 'number' ? p.token_version : 1) + 1
      data.profile = {
        ...p,
        token_version: tv,
        password_changed_at: new Date().toISOString(),
      } as Prisma.InputJsonValue
    }
    return t.user.update({
      where: { id: userId },
      data,
    })
  }
  if (tx) return run(tx)
  return prisma.$transaction(run)
}

/**
 * Public Module API: Xác thực token và lấy thông tin phiên đang hoạt động từ CSDL
 */
export async function verifyAndLoadActiveUser(token: string) {
  const decoded = jwt.verify(token, env.JWT_SECRET) as {
    id?: string
    role?: string
    tv?: number
    iat?: number
    amr?: string[]
  }

  if (!decoded?.id) {
    throw new AppError(401, 'Invalid token payload')
  }

  let user: any = null
  try {
    user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        roles: true,
        employees: {
          include: {
            department: true,
            position: true,
          },
        },
      },
    })
  } catch {
    throw new AppError(401, 'Invalid user ID in token')
  }

  if (!user || !user.is_active) {
    throw new AppError(401, 'Tài khoản người dùng đã bị khóa hoặc không tồn tại')
  }

  if (user.employees) {
    if (user.employees.status === 'TERMINATED' || user.employees.status === 'INACTIVE') {
      throw new AppError(401, 'Tài khoản nhân viên không còn hoạt động')
    }
  }

  const profile = (user.profile && typeof user.profile === 'object') ? (user.profile as Record<string, unknown>) : {}
  const currentTv = typeof profile.token_version === 'number' ? profile.token_version : 1
  const tokenTv = typeof decoded.tv === 'number' ? decoded.tv : 1
  await assertFaceSession(decoded.amr, user.employees?.id, user.roles.role_name)
  if (decoded.amr?.includes('face') && user.employees?.status !== 'ACTIVE') {
    throw AppError.unauthorized('Phiên đăng nhập khuôn mặt đã hết hiệu lực. Vui lòng đăng nhập bằng mật khẩu.')
  }
  if (tokenTv < currentTv) {
    throw new AppError(401, 'Phiên đăng nhập đã hết hạn hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại.')
  }

  if (profile.password_changed_at && decoded.iat) {
    const pwdTime = new Date(profile.password_changed_at as string).getTime()
    // 1000ms grace window for clock skew between iat (seconds) and Date ISO
    if (decoded.iat * 1000 < pwdTime - 1000) {
      throw new AppError(401, 'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.')
    }
  }

  const safe = safeUser(user)
  const { avatar: _avatar, ...authUser } = safe
  return { ...authUser, amr: decoded.amr }
}

/**
 * Public Module API: Tìm Role theo tên (hỗ trợ transaction)
 */
export async function getRoleByName(roleName: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.roles.findFirst({
    where: { role_name: { equals: roleName, mode: 'insensitive' } },
  })
}

/**
 * Public Module API: Lấy Role mặc định cho nhân viên mới (EMPLOYEE)
 */
export async function getDefaultRole(tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  const empRole = await client.roles.findFirst({
    where: { role_name: { equals: 'EMPLOYEE', mode: 'insensitive' } },
  })
  return empRole || client.roles.findFirst()
}

/**
 * Public Module API: Xóa tài khoản User (hỗ trợ transaction)
 */
export async function deleteAuthUser(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.user.delete({
    where: { id: userId },
  })
}

/**
 * Public Module API: Lấy ID của các Admin đang hoạt động (hỗ trợ transaction)
 */
export async function findActiveAdminUserIds(tx?: Prisma.TransactionClient): Promise<string[]> {
  const client = tx ?? prisma
  const admins = await client.user.findMany({
    where: { is_active: true, roles: { role_name: 'ADMIN' } },
    select: { id: true },
  })
  return admins.map((a: { id: string }) => a.id)
}

/**
 * Public Module API: Lấy ID của các Admin và Manager đang hoạt động (hỗ trợ transaction)
 */
export async function findActiveManagerAndAdminUserIds(tx?: Prisma.TransactionClient): Promise<string[]> {
  const client = tx ?? prisma
  const users = await client.user.findMany({
    where: { is_active: true, roles: { role_name: { in: ['ADMIN', 'MANAGER'] } } },
    select: { id: true },
  })
  return users.map((u: { id: string }) => u.id)
}

export async function findActiveManagerUserIdsByDepartment(
  departmentId: number,
  excludeEmployeeId?: string,
  tx?: Prisma.TransactionClient
): Promise<string[]> {
  const client = tx ?? prisma
  const managers = await client.user.findMany({
    where: {
      is_active: true,
      roles: { role_name: 'MANAGER' },
      employees: {
        departmentId,
        status: 'ACTIVE',
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
    },
    select: { id: true },
  })
  return managers.map(m => m.id)
}

export type ActiveAlertRecipient = {
  id: string
  role: string
  departmentId?: number | null
  status?: string | null
}

/**
 * Public Module API: Lấy danh sách người nhận cảnh báo hệ thống (Admin & Manager)
 */
export async function findActiveAlertRecipients(tx?: Prisma.TransactionClient): Promise<ActiveAlertRecipient[]> {
  const client = tx ?? prisma
  const users = await client.user.findMany({
    where: { is_active: true, roles: { role_name: { in: ['ADMIN', 'MANAGER'] } } },
    select: {
      id: true,
      roles: { select: { role_name: true } },
      employees: { select: { departmentId: true, status: true } },
    },
  })
  return users.map(u => ({
    id: u.id,
    role: u.roles.role_name,
    departmentId: u.employees?.departmentId ?? null,
    status: u.employees?.status ?? null,
  }))
}
