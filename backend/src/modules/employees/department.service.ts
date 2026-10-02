import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

export interface DepartmentItem {
  id: number
  department_code: string
  name: string
  employee_count: number
  created_at: Date
}

export async function listDepartments(): Promise<DepartmentItem[]> {
  const depts = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  return depts.map((d) => ({
    id: d.id,
    department_code: d.department_code,
    name: d.name,
    employee_count: d._count.employees,
    created_at: d.createdAt,
  }))
}

export async function createDepartment(
  data: { name: string; department_code?: string },
  actorUserId?: string
): Promise<DepartmentItem> {
  if (!data.name || !data.name.trim()) {
    throw new AppError(400, 'Tên chức vụ không được để trống')
  }

  const trimmedName = data.name.trim()

  const existing = await prisma.department.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  })

  if (existing) {
    throw new AppError(409, `Chức vụ '${trimmedName}' đã tồn tại trong hệ thống`)
  }

  // Generate clean department_code
  const codeCandidate =
    data.department_code?.trim() ||
    `POS_${trimmedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`

  const created = await prisma.department.create({
    data: {
      name: trimmedName,
      department_code: codeCandidate.slice(0, 50),
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
    employee_count: 0,
    created_at: created.createdAt,
  }
}

export async function updateDepartment(
  id: number,
  data: { name: string },
  actorUserId?: string
) {
  if (!data.name || !data.name.trim()) {
    throw new AppError(400, 'Tên chức vụ không được để trống')
  }

  const trimmedName = data.name.trim()

  const existing = await prisma.department.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy chức vụ cần sửa')
  }

  // Check duplicate with others
  const duplicate = await prisma.department.findFirst({
    where: {
      name: { equals: trimmedName, mode: 'insensitive' },
      id: { not: id },
    },
  })

  if (duplicate) {
    throw new AppError(409, `Chức vụ '${trimmedName}' đã được đặt cho bản ghi khác`)
  }

  const updated = await prisma.department.update({
    where: { id },
    data: { name: trimmedName },
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
  }
}

export async function deleteDepartment(id: number, actorUserId?: string) {
  const existing = await prisma.department.findUnique({
    where: { id },
    include: { employees: true },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy chức vụ cần xóa')
  }

  // An toàn: gỡ liên kết departmentId cho các nhân viên đang mang chức vụ này
  if (existing.employees.length > 0) {
    await prisma.employee.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    })
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
