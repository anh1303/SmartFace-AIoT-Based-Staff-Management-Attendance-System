import { prisma } from '../../config/database.js'

export type AuthScopeUser = {
  id: string; username: string; is_active: boolean; profile: unknown
  roles: { role_name: string }
  employees: {
    id: string; employee_code: string; full_name: string; email: string | null; status: string
    departmentId: number | null; positionId: number | null
    department: { name: string } | null; position: { id: number; name: string } | null
  } | null
}

/** Project JSON metadata in SQL too: profiles can contain an inline image. */
export async function readAuthUser(userId: string): Promise<AuthScopeUser | null> {
  const rows = await prisma.$queryRaw<AuthScopeUser[]>`
    SELECT u.id, u.username, u.is_active,
      jsonb_build_object('token_version', u.profile->'token_version',
        'password_changed_at', u.profile->'password_changed_at',
        'display_name', u.profile->'display_name') AS profile,
      jsonb_build_object('role_name', r.role_name) AS roles,
      CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', e.id, 'employee_code', e.employee_code, 'full_name', e.full_name,
        'email', e.email, 'status', e.status, 'departmentId', e.department_id,
        'positionId', e.position_id,
        'department', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object('name', d.name) END,
        'position', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'name', p.name) END
      ) END AS employees
    FROM users u JOIN roles r ON r.id = u.role_id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE u.id = ${userId}::uuid
  `
  return rows[0] ?? null
}
