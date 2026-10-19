import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

export interface PositionItemDto {
  id: number
  position_code: string
  name: string
  level: 'MANAGER' | 'EMPLOYEE'
  department_id: number
  department_code: string
  department_name: string
  employee_count: number
  is_active: boolean
  created_at: Date
}

export async function listPositions(): Promise<PositionItemDto[]> {
  const positions = await prisma.position.findMany({
    include: {
      department: true,
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  return positions.map((p) => ({
    id: p.id,
    position_code: p.position_code,
    name: p.name,
    level: p.level,
    department_id: p.departmentId,
    // Cung cấp department_code cho tương thích ngược với frontend PositionItem
    department_code: p.position_code,
    department_name: p.department?.name || '',
    employee_count: p._count.employees,
    is_active: p.is_active,
    created_at: p.createdAt,
  }))
}

export async function createPosition(
  data: {
    name: string
    position_code?: string
    department_id?: number
    departmentId?: number
    level?: 'MANAGER' | 'EMPLOYEE'
  },
  actorUserId?: string
): Promise<PositionItemDto> {
  if (!data.name || !data.name.trim()) {
    throw new AppError(400, 'Tên chức vụ không được để trống')
  }

  const trimmedName = data.name.trim()

  // Kiểm tra trùng lặp
  const existing = await prisma.position.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  })

  if (existing) {
    throw new AppError(409, `Chức vụ '${trimmedName}' đã tồn tại trong hệ thống`)
  }

  // Xác định department_id hợp lệ
  let deptId = data.departmentId ?? data.department_id
  if (!deptId) {
    const firstDept = await prisma.department.findFirst({ orderBy: { id: 'asc' } })
    if (!firstDept) {
      throw new AppError(500, 'Chưa có phòng ban nào trong hệ thống để gán chức vụ')
    }
    deptId = firstDept.id
  }

  // Sinh mã position_code chuẩn hóa
  const codeCandidate =
    data.position_code?.trim() ||
    `POS_${trimmedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`

  const created = await prisma.position.create({
    data: {
      name: trimmedName,
      position_code: codeCandidate.slice(0, 50),
      level: data.level || (/quản lý|manager|trưởng phòng|giám đốc/i.test(trimmedName) ? 'MANAGER' : 'EMPLOYEE'),
      departmentId: deptId,
      is_active: true,
    },
    include: {
      department: true,
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'CREATE_POSITION',
    target_table: 'positions',
    record_id: String(created.id),
    new_values: {
      name: created.name,
      position_code: created.position_code,
      level: created.level,
      department_id: created.departmentId,
    },
  })

  return {
    id: created.id,
    position_code: created.position_code,
    name: created.name,
    level: created.level,
    department_id: created.departmentId,
    department_code: created.position_code,
    department_name: created.department?.name || '',
    employee_count: 0,
    is_active: created.is_active,
    created_at: created.createdAt,
  }
}

export async function updatePosition(
  id: number,
  data: {
    name?: string
    level?: 'MANAGER' | 'EMPLOYEE'
    department_id?: number
    departmentId?: number
    is_active?: boolean
  },
  actorUserId?: string
) {
  const existing = await prisma.position.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy chức vụ cần sửa')
  }

  const trimmedName = data.name ? data.name.trim() : existing.name
  if (!trimmedName) {
    throw new AppError(400, 'Tên chức vụ không được để trống')
  }

  if (data.name && trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.position.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        id: { not: id },
      },
    })
    if (duplicate) {
      throw new AppError(409, `Chức vụ '${trimmedName}' đã được đặt cho bản ghi khác`)
    }
  }

  const deptId = data.departmentId ?? data.department_id ?? existing.departmentId

  const updated = await prisma.position.update({
    where: { id },
    data: {
      name: trimmedName,
      level: data.level ?? existing.level,
      departmentId: deptId,
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    },
    include: {
      department: true,
      _count: {
        select: { employees: true },
      },
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_POSITION',
    target_table: 'positions',
    record_id: String(updated.id),
    old_values: { name: existing.name, level: existing.level },
    new_values: { name: updated.name, level: updated.level },
  })

  return {
    id: updated.id,
    position_code: updated.position_code,
    name: updated.name,
    level: updated.level,
    department_id: updated.departmentId,
    department_code: updated.position_code,
    department_name: updated.department?.name || '',
    employee_count: updated._count.employees,
    is_active: updated.is_active,
    created_at: updated.createdAt,
  }
}

export async function deletePosition(id: number, actorUserId?: string) {
  const existing = await prisma.position.findUnique({
    where: { id },
    include: { employees: true },
  })

  if (!existing) {
    throw new AppError(404, 'Không tìm thấy chức vụ cần xóa')
  }

  // An toàn: gỡ liên kết positionId cho các nhân viên đang mang chức vụ này
  if (existing.employees.length > 0) {
    await prisma.employee.updateMany({
      where: { positionId: id },
      data: { positionId: null },
    })
  }

  await prisma.position.delete({
    where: { id },
  })

  await logAction({
    userId: actorUserId,
    action: 'DELETE_POSITION',
    target_table: 'positions',
    record_id: String(id),
    old_values: { name: existing.name, position_code: existing.position_code },
  })

  return { success: true }
}
