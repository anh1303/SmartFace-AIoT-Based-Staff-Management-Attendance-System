import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, generateUniqueEmployeeCode } from '../../common/utils.js'
import { logAction } from '../audit-logs/audit.service.js'
import { employeeInclude } from './employee.model.js'

export interface RawEmployeeDb {
  id: string
  employee_code?: string | null
  full_name: string
  department?: { name?: string } | null
  position?: string | null
  phone?: string | null
  email?: string | null
  status?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  face_embeddings?: unknown[] | null
  fingerprint_enrolled?: boolean | null
  avatar_url?: string | null
  hourly_rate?: { toString(): string } | number | string | bigint | null
  departmentId?: number | null
}

export function formatEmployee(emp: RawEmployeeDb) {
  return {
    id: emp.id,
    employee_id: emp.employee_code || emp.id,
    full_name: emp.full_name,
    department: emp.department?.name || '',
    position: emp.position || '',
    phone: emp.phone || '',
    email: emp.email || '',
    status: emp.status,
    created_at: emp.createdAt ? emp.createdAt.toISOString() : new Date().toISOString(),
    updated_at: emp.updatedAt ? emp.updatedAt.toISOString() : new Date().toISOString(),
    face_enrolled: Array.isArray(emp.face_embeddings) && emp.face_embeddings.length > 0,
    fingerprint_enrolled: Boolean(emp.fingerprint_enrolled),
    avatar: emp.avatar_url || '',
    hourly_rate: emp.hourly_rate ? Number(emp.hourly_rate) : 0,
    departmentId: emp.departmentId,
  }
}

export async function list(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const search = typeof query.search === 'string' ? query.search : ''

  const departmentId =
    typeof query.departmentId === 'string' && query.departmentId
      ? parseInt(query.departmentId, 10)
      : undefined

  const where = {
    ...(search
      ? {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { employee_code: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {}),
    ...(typeof query.status === 'string' ? { status: query.status } : {}),
    ...(departmentId ? { departmentId } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ])

  return {
    items: items.map(formatEmployee),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}



export async function get(idOrCode: string) {
  const item = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
    include: employeeInclude,
  })
  if (!item) throw new AppError(404, 'Employee not found')
  return formatEmployee(item)
}

export async function create(data: {
  employee_code?: string
  full_name: string
  email?: string | null
  position?: string | null
  departmentId?: number | null
  department?: string | null
  status?: string
  phone?: string | null
  hourly_rate?: number
  avatar?: string | null
  avatar_url?: string | null
}, actorUserId?: string) {
  let deptId = data.departmentId

  if (!deptId && data.department) {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: data.department, mode: 'insensitive' } },
    })
    if (dept) deptId = dept.id
  }

  const emailVal = data.email && data.email.trim() !== '' ? data.email.trim() : null
  const codeCandidate = data.employee_code && data.employee_code.trim() !== ''
    ? data.employee_code.trim()
    : await generateUniqueEmployeeCode()

  // Ensure unique employee_code
  const existingCode = await prisma.employee.findFirst({ where: { employee_code: codeCandidate } })
  const finalCode = existingCode ? await generateUniqueEmployeeCode() : codeCandidate

  // Check email uniqueness if email provided
  if (emailVal) {
    const existingEmail = await prisma.employee.findFirst({ where: { email: emailVal } })
    if (existingEmail) {
      throw new AppError(409, `Email '${emailVal}' đã được sử dụng bởi nhân viên khác`)
    }
  }

  const rate = data.hourly_rate ?? 0

  const created = await prisma.employee.create({
    data: {
      employee_code: finalCode,
      full_name: data.full_name,
      email: emailVal,
      position: data.position || null,
      departmentId: deptId ?? null,
      status: data.status ?? 'ACTIVE',
      phone: data.phone || null,
      hourly_rate: rate,
      avatar_url: data.avatar_url ?? data.avatar ?? null,
    },
    include: employeeInclude,
  })

  await logAction({
    userId: actorUserId,
    action: 'CREATE_EMPLOYEE',
    target_table: 'employees',
    record_id: created.id,
    new_values: {
      employee_code: created.employee_code,
      full_name: created.full_name,
      email: created.email,
      position: created.position,
      departmentId: created.departmentId,
      status: created.status,
    },
  })

  return formatEmployee(created)
}

export async function update(
  idOrCode: string,
  data: {
    full_name?: string
    email?: string | null
    position?: string | null
    departmentId?: number | null
    department?: string | null
    status?: string
    phone?: string | null
    avatar_url?: string | null
    avatar?: string | null
    hourly_rate?: number
  },
  actorUserId?: string,
) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
  })
  if (!existing) throw new AppError(404, 'Employee not found')

  let deptId = data.departmentId
  if (deptId === undefined && data.department) {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: data.department, mode: 'insensitive' } },
    })
    if (dept) deptId = dept.id
  }

  const rateVal = data.hourly_rate

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data: {
      ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      ...(deptId !== undefined ? { departmentId: deptId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.avatar_url !== undefined || data.avatar !== undefined
        ? { avatar_url: data.avatar_url ?? data.avatar }
        : {}),
      ...(rateVal !== undefined ? { hourly_rate: rateVal } : {}),
    },
    include: employeeInclude,
  })

  if (existing.user_id && data.status !== undefined) {
    await prisma.user.update({
      where: { id: existing.user_id },
      data: { is_active: data.status === 'ACTIVE' },
    }).catch(() => { })
  }

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_EMPLOYEE',
    target_table: 'employees',
    record_id: existing.id,
    old_values: {
      full_name: existing.full_name,
      email: existing.email,
      position: existing.position,
      departmentId: existing.departmentId,
      status: existing.status,
      hourly_rate: existing.hourly_rate ? Number(existing.hourly_rate) : 0,
    },
    new_values: {
      full_name: updated.full_name,
      email: updated.email,
      position: updated.position,
      departmentId: updated.departmentId,
      status: updated.status,
      hourly_rate: updated.hourly_rate ? Number(updated.hourly_rate) : 0,
    },
  })

  return formatEmployee(updated)
}

/**
 * 5. Soft-delete nhân viên: chuyển trạng thái sang TERMINATED và vô hiệu hóa tài khoản User trong transaction
 */
export async function terminate(idOrCode: string, actorUserId?: string) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
  })
  if (!existing) throw new AppError(404, 'Employee not found')

  return prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: existing.id },
      data: { status: 'TERMINATED' },
    })

    if (existing.user_id) {
      await tx.user.update({
        where: { id: existing.user_id },
        data: { is_active: false },
      }).catch(() => { })
    }

    await logAction({
      userId: actorUserId,
      action: 'TERMINATE_EMPLOYEE',
      target_table: 'employees',
      record_id: existing.id,
      old_values: { status: existing.status },
      new_values: { status: 'TERMINATED', user_disabled: true },
    })
  })
}

// Giữ alias remove để đảm bảo tương thích ngược toàn bộ router/controller
export const remove = terminate