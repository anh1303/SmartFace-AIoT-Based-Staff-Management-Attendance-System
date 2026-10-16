import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

export interface DepartmentItem {
  id: number
  department_code: string
  name: string
  description?: string | null
  is_active: boolean
  employee_count: number
  position_count: number
  created_at: Date
}

export async function listDepartments(): Promise<DepartmentItem[]> {
  const depts = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true, positions: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  return depts.map((d) => ({
    id: d.id,
    department_code: d.department_code,
    name: d.name,
    description: d.description,
    is_active: d.is_active,
    employee_count: d._count.employees,
    position_count: d._count.positions,
    created_at: d.createdAt,
  }))
}

export async function createDepartment(
  data: { name: string; department_code?: string; description?: string },
  actorUserId?: string
): Promise<DepartmentItem> {
  if (!data.name || !data.name.trim()) {
    throw new AppError(400, 'Tên phòng ban không được để trống')
  }

  const trimmedName = data.name.trim()

  const existing = await prisma.department.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  })

  if (existing) {
    throw new AppError(409, `Phòng ban '${trimmedName}' đã tồn tại trong hệ thống`)
  }

  // Generate clean department_code
  const codeCandidate =
    data.department_code?.trim() ||
    `DEPT_${trimmedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`

  const created = await prisma.department.create({
    data: {
      name: trimmedName,
      department_code: codeCandidate.slice(0, 50),
      description: data.description?.trim() || null,
      is_active: true,
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'CREATE_DEPARTMENT',
    target_table: 'departments',
    record_id: String(created.id),
    new_values: { name: created.name, department_code: created.department_code },
  })

  return {
    id: created.id,
    department_code: created.department_code,
    name: created.name,
    description: created.description,
    is_active: created.is_active,
    employee_count: 0,
    position_count: 0,
    created_at: created.createdAt,
  }
}

export async function updateDepartment(
  id: number,
  data: { name?: string; description?: string; is_active?: boolean },
  actorUserId?: string
) {
  const existing = await prisma.department.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy phòng ban cần sửa')
  }

  const trimmedName = data.name ? data.name.trim() : existing.name
  if (!trimmedName) {
    throw new AppError(400, 'Tên phòng ban không được để trống')
  }

  if (data.name && trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.department.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        id: { not: id },
      },
    })

    if (duplicate) {
      throw new AppError(409, `Phòng ban '${trimmedName}' đã được đặt cho bản ghi khác`)
    }
  }

  const updated = await prisma.department.update({
    where: { id },
    data: {
      name: trimmedName,
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    },
    include: {
      _count: { select: { employees: true, positions: true } },
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_DEPARTMENT',
    target_table: 'departments',
    record_id: String(updated.id),
    old_values: { name: existing.name },
    new_values: { name: updated.name },
  })

  return {
    id: updated.id,
    department_code: updated.department_code,
    name: updated.name,
    description: updated.description,
    is_active: updated.is_active,
    employee_count: updated._count.employees,
    position_count: updated._count.positions,
    created_at: updated.createdAt,
  }
}

export async function deleteDepartment(id: number, actorUserId?: string) {
  const existing = await prisma.department.findUnique({
    where: { id },
    include: { employees: true, positions: true },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy phòng ban cần xóa')
  }

  // An toàn: gỡ liên kết departmentId cho các nhân viên đang thuộc phòng ban này
  if (existing.employees.length > 0) {
    await prisma.employee.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    })
  }

  // An toàn: gỡ liên kết hoặc xóa positions thuộc phòng ban nếu cần
  if (existing.positions.length > 0) {
    const firstOtherDept = await prisma.department.findFirst({
      where: { id: { not: id } },
      orderBy: { id: 'asc' },
    })
    if (firstOtherDept) {
      await prisma.position.updateMany({
        where: { departmentId: id },
        data: { departmentId: firstOtherDept.id },
      })
    }
  }

  await prisma.department.delete({
    where: { id },
  })

  await logAction({
    userId: actorUserId,
    action: 'DELETE_DEPARTMENT',
    target_table: 'departments',
    record_id: String(id),
    old_values: { name: existing.name, department_code: existing.department_code },
  })

  return { success: true }
}

