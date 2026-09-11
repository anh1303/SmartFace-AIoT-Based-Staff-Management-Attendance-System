import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { employeeInclude } from './employee.model.js'

export function formatEmployee(emp: any) {
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
    fingerprint_enrolled: true,
    avatar: emp.avatar_url || '',
    base_salary: emp.base_salary ? Number(emp.base_salary) : 0,
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
    deleted_at: null,
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
    where: {
      ...buildIdOrCodeWhere(idOrCode),
      deleted_at: null,
    },
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
  base_salary?: number
  avatar?: string | null
  avatar_url?: string | null
}) {
  let deptId = data.departmentId

  if (!deptId && data.department) {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: data.department, mode: 'insensitive' } },
    })
    if (dept) deptId = dept.id
  }

  const emailVal = data.email && data.email.trim() !== '' ? data.email.trim() : null
  const codeCandidate = data.employee_code && data.employee_code.trim() !== '' ? data.employee_code.trim() : `EMP-${Date.now()}`

  // Ensure unique employee_code
  const existingCode = await prisma.employee.findFirst({ where: { employee_code: codeCandidate } })
  const finalCode = existingCode ? `EMP-${Date.now()}` : codeCandidate

  // Check email uniqueness if email provided
  if (emailVal) {
    const existingEmail = await prisma.employee.findFirst({ where: { email: emailVal } })
    if (existingEmail) {
      throw new AppError(409, `Email '${emailVal}' đã được sử dụng bởi nhân viên khác`)
    }
  }

  const created = await prisma.employee.create({
    data: {
      employee_code: finalCode,
      full_name: data.full_name,
      email: emailVal,
      position: data.position || null,
      departmentId: deptId ?? null,
      status: data.status ?? 'ACTIVE',
      phone: data.phone || null,
      base_salary: data.base_salary ?? 0,
      avatar_url: data.avatar_url ?? data.avatar ?? null,
    },
    include: employeeInclude,
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
    base_salary?: number
  },
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
      ...(data.base_salary !== undefined ? { base_salary: data.base_salary } : {}),
    },
    include: employeeInclude,
  })

  return formatEmployee(updated)
}

export async function remove(idOrCode: string) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
  })
  if (!existing) throw new AppError(404, 'Employee not found')

  await prisma.employee.update({
    where: { id: existing.id },
    data: { deleted_at: new Date(), status: 'TERMINATED' },
  })
}
