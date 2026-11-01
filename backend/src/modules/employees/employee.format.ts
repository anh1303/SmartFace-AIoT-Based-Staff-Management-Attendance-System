export interface RawEmployeeDb {
  id: string
  employee_code?: string | null
  full_name: string
  department?: { name?: string } | null
  position?: { id?: number; name?: string; level?: string; position_code?: string } | string | null
  positionId?: number | null
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
  users?: {
    id?: string
    username?: string
    is_active?: boolean
    roles?: { role_name?: string } | null
  } | null
}

export function formatEmployee(emp: RawEmployeeDb) {
  const roleName =
    emp.users?.roles?.role_name?.toUpperCase() ||
    (emp.department?.name === 'Quản lý' ? 'MANAGER' : 'EMPLOYEE')

  const posName =
    typeof emp.position === 'string'
      ? emp.position
      : emp.position?.name || ''
  const posLevel =
    typeof emp.position === 'object' && emp.position
      ? (emp.position as any).level
      : undefined

  const isManager =
    roleName === 'MANAGER' ||
    roleName === 'ADMIN' ||
    posLevel === 'MANAGER' ||
    Boolean(posName && /quản lý|manager/i.test(posName)) ||
    Boolean(emp.department?.name && /quản lý/i.test(emp.department.name))

  return {
    id: emp.id,
    employee_id: emp.employee_code || emp.id,
    username: emp.users?.username || emp.employee_code || emp.id,
    full_name: emp.full_name,
    department: emp.department?.name || '',
    position: posName,
    positionId: emp.positionId ?? (typeof emp.position === 'object' && emp.position ? (emp.position as any).id : null),
    positionLevel: posLevel,
    phone: emp.phone || '',
    email: emp.email || '',
    status: emp.status,
    role: roleName,
    is_manager: isManager,
    created_at: emp.createdAt ? emp.createdAt.toISOString() : new Date().toISOString(),
    updated_at: emp.updatedAt ? emp.updatedAt.toISOString() : new Date().toISOString(),
    face_enrolled: Array.isArray(emp.face_embeddings) && emp.face_embeddings.length > 0,
    fingerprint_enrolled: Boolean(emp.fingerprint_enrolled),
    avatar: emp.avatar_url || '',
    hourly_rate: emp.hourly_rate ? Number(emp.hourly_rate) : 0,
    departmentId: emp.departmentId,
  }
}

