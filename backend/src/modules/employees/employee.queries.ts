import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

export function findDepartmentByIdOrCode(value: string | number) {
  const id = Number(value)
  return Number.isNaN(id)
    ? prisma.department.findFirst({ where: { department_code: { equals: String(value), mode: 'insensitive' } } })
    : prisma.department.findUnique({ where: { id } })
}

export function findPositionByName(name: string) {
  return prisma.position.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' } } })
}
import { buildIdOrCodeWhere } from './employee.model.js'
import { employeeInclude } from './employee.model.js'

const identitySelect = { id: true, employee_code: true, full_name: true, user_id: true, status: true, departmentId: true,
  position: { select: { name: true, level: true } }, department: { select: { name: true } },
  users: { select: { roles: { select: { role_name: true } } } } } as const
type EmployeeProfile = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>
type EmployeeIdentity = Prisma.EmployeeGetPayload<{ select: typeof identitySelect }>
const calculationSelect = { id: true, employee_code: true, full_name: true, user_id: true, status: true,
  departmentId: true, positionId: true, createdAt: true, hourly_rate: true, hourly_rate_history: true } as const

export function getEmployeeClient(tx?: Prisma.TransactionClient) {
  return (tx && 'employee' in tx ? tx : prisma)
}

export function updateEmployeePersonalDetails(userId: string, data: { full_name: string; email: string | null; phone: string | null; avatar_url?: string | null }, tx: Prisma.TransactionClient) {
  return tx.employee.updateMany({ where: { user_id: userId }, data })
}

/**
 * Public Module API: Tìm một nhân viên theo UUID hoặc mã nhân viên (hỗ trợ transaction)
 */
export function findEmployeeByIdOrCode(idOrCode: string, tx?: Prisma.TransactionClient): Promise<EmployeeProfile | null>
export function findEmployeeByIdOrCode(idOrCode: string, tx: Prisma.TransactionClient | undefined, projection: 'identity'): Promise<EmployeeIdentity | null>
export async function findEmployeeByIdOrCode(idOrCode: string, tx?: Prisma.TransactionClient, projection?: 'identity') {
  const client = getEmployeeClient(tx)
  const fields = projection === 'identity' ? { select: identitySelect } : { include: employeeInclude }
  if (typeof (client as any)?.employee?.findFirst === 'function') {
    const read = () => (client as any).employee.findFirst({
      where: buildIdOrCodeWhere(idOrCode),
      ...fields,
    })
    try {
      return await read()
    } catch (err: any) {
      // Retry only this read outside a transaction, never an attendance write.
      // A closed pooled connection may succeed on the next connection.
      if (tx || err?.code !== 'P1017') throw err
      console.warn('[DB] Employee lookup connection closed (P1017); retrying read once')
      return read()
    }
  }
  if (typeof (client as any)?.employee?.findUnique === 'function') {
    return (client as any).employee.findUnique({
      where: { id: idOrCode },
      ...fields,
    })
  }
  return null
}

/**
 * Public Module API: Lấy danh sách nhân viên theo danh sách ID (hỗ trợ transaction)
 */
export async function findEmployeesByIds(ids: string[], tx?: Prisma.TransactionClient) {
  const client = getEmployeeClient(tx)
  return client.employee.findMany({
    where: { id: { in: ids } },
    include: employeeInclude,
  })
}

/**
 * Public Module API: Lấy projection siêu nhẹ (id, departmentId) theo danh sách ID hoặc mã nhân viên
 * để định tuyến room cho Socket.IO /operations mà không kéo nguyên hồ sơ nhân viên.
 */
export async function findEmployeesRoomMetadata(
  idsOrCodes: readonly string[],
  tx?: Prisma.TransactionClient,
): Promise<Array<{ id: string; departmentId: number | null }>> {
  const unique = [...new Set(idsOrCodes.filter(Boolean))]
  if (unique.length === 0) return []
  const uuids = unique.filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
  const codes = unique.filter((v) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
  const orClauses: Prisma.EmployeeWhereInput[] = []
  if (uuids.length > 0) orClauses.push({ id: { in: uuids } })
  if (codes.length > 0) orClauses.push({ employee_code: { in: codes } })
  const client = getEmployeeClient(tx)
  return client.employee.findMany({
    where: orClauses.length === 1 ? orClauses[0] : { OR: orClauses },
    select: { id: true, departmentId: true },
  })
}

/**
 * Public Module API: Lấy tất cả nhân viên đang hoạt động (ACTIVE, hỗ trợ transaction)
 */
export async function findActiveEmployees(tx?: Prisma.TransactionClient) {
  const client = getEmployeeClient(tx)
  return client.employee.findMany({
    where: { status: 'ACTIVE' },
    include: employeeInclude,
  })
}

/**
 * Public Module API: Lấy danh sách ID của tất cả nhân viên đang hoạt động (ACTIVE, hỗ trợ transaction)
 */
export async function findActiveEmployeeIds(tx?: Prisma.TransactionClient): Promise<string[]> {
  const client = getEmployeeClient(tx)
  const rows = await client.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })
  return rows.map((r: any) => r.id)
}

/**
 * Public Module API: Tìm nhân viên theo user_id tài khoản (hỗ trợ transaction)
 */
export function findEmployeeByUserId(userId: string, tx?: Prisma.TransactionClient): Promise<EmployeeProfile | null>
export function findEmployeeByUserId(userId: string, tx: Prisma.TransactionClient | undefined, projection: 'identity'): Promise<EmployeeIdentity | null>
export async function findEmployeeByUserId(userId: string, tx?: Prisma.TransactionClient, projection?: 'identity') {
  const client = getEmployeeClient(tx)
  return projection === 'identity'
    ? client.employee.findFirst({ where: { user_id: userId }, select: identitySelect })
    : client.employee.findFirst({ where: { user_id: userId }, include: employeeInclude })
}

/**
 * Public Module API: Tìm nhân viên theo email (hỗ trợ transaction)
 */
export async function findEmployeeByEmail(email: string, tx?: Prisma.TransactionClient) {
  const client = getEmployeeClient(tx)
  return client.employee.findFirst({
    where: { email },
    include: employeeInclude,
  })
}

/**
 * Public Module API: Tạo nhân viên mới (dành cho module auth khi đăng ký, hỗ trợ transaction)
 */
export async function createEmployee(
  data: Prisma.EmployeeUncheckedCreateInput,
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  return client.employee.create({
    data,
    include: employeeInclude,
  })
}

/**
 * Public Module API: Đếm tổng số nhân viên đang hoạt động (ACTIVE)
 */
export async function countActiveEmployees(tx?: Prisma.TransactionClient) {
  const client = getEmployeeClient(tx)
  return client.employee.count({ where: { status: 'ACTIVE' } })
}

/**
 * Public Module API: Tìm nhân viên theo empId hoặc userId
 */
export async function findEmployeeByIdOrUserId(
  identifier: { empId?: string | null; userId?: string | null },
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  if (identifier.empId) {
    const byId = await client.employee.findFirst({
      where: buildIdOrCodeWhere(identifier.empId),
      include: employeeInclude,
    })
    if (byId) return byId
  }
  if (identifier.userId) {
    return client.employee.findFirst({
      where: { user_id: identifier.userId },
      include: employeeInclude,
    })
  }
  return null
}

/**
 * Public Module API: Đếm số lượng nhân viên đang hoạt động (ACTIVE) theo scope quyền hạn hoặc phòng ban
 */
export async function countScopedEmployees(
  scope?: Prisma.EmployeeWhereInput | number,
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  const scopeWhere: Prisma.EmployeeWhereInput = typeof scope === 'number'
    ? { departmentId: scope }
    : (scope ?? {})

  const where: Prisma.EmployeeWhereInput = Object.keys(scopeWhere).length > 0
    ? { AND: [scopeWhere, { status: 'ACTIVE' }] }
    : { status: 'ACTIVE' }

  return client.employee.count({ where })
}

/**
 * Public Module API: Cập nhật trạng thái nhân sự thành TERMINATED khi quyết toán sớm
 */
export async function terminateEmployee(
  employeeId: string,
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  return client.employee.update({
    where: { id: employeeId },
    data: { status: 'TERMINATED' },
  })
}

/**
 * Public Module API: Tìm kiếm danh sách nhân viên theo bộ lọc (phục vụ Attendance Aggregation & Payroll Generation)
 */
export async function findEmployeesWithFilter(
  where: Prisma.EmployeeWhereInput,
  options?: {
    includeRelations?: boolean
    includeUsersAndRoles?: boolean
  },
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  if (options?.includeUsersAndRoles) {
    return client.employee.findMany({
      where,
      select: { ...calculationSelect, department: true, position: true, users: { select: { id: true, roles: { select: { role_name: true } } } } },
    })
  }
  if (options?.includeRelations) {
    return client.employee.findMany({
      where,
      select: { ...calculationSelect, department: true, position: true },
    })
  }
  return client.employee.findMany({ where, select: calculationSelect })
}

/**
 * Public Module API: Lấy hồ sơ tính lương/lương theo giờ của nhân viên
 */
export async function findEmployeeWageProfile(
  id: string,
  tx?: Prisma.TransactionClient,
  mode: boolean | 'edge' | 'routing' = false
) {
  const client = getEmployeeClient(tx)
  const includeRouting = mode === true || mode === 'edge' || mode === 'routing'
  const includeAvatar = mode === true || mode === 'edge'
  return client.employee.findFirst({
    where: { id },
    select: {
      id: true,
      status: true,
      hourly_rate: true,
      hourly_rate_history: true,
      ...(includeRouting
        ? {
            user_id: true,
            ...(includeAvatar ? { avatar_url: true } : {}),
            full_name: true,
            employee_code: true,
            departmentId: true,
            department: { select: { name: true } },
            position: { select: { name: true, level: true } },
            users: { select: { roles: { select: { role_name: true } } } },
          }
        : {}),
    },
  })
}

/**
 * Public Module API: Lấy chi tiết quan hệ phòng ban/chức vụ/tài khoản của nhân viên
 */
export async function findEmployeeWithRelations(
  id: string,
  tx?: Prisma.TransactionClient
) {
  const client = getEmployeeClient(tx)
  return client.employee.findUnique({
    where: { id },
    select: identitySelect,
  })
}
