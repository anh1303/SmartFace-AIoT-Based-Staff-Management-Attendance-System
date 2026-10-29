import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/AppError.js';
import { buildIdOrCodeWhere } from '../../common/utils.js';

/**
 * Kiểm tra xem một nhân viên có vai trò hoặc chức vụ là Quản lý/Admin không
 */
export function isEmployeeManager(target: {
  position?: { name?: string | null; level?: string | null } | string | null;
  positionId?: number | null;
  department?: { name?: string | null } | null;
  users?: { roles?: { role_name?: string | null } | null } | null;
} | null | undefined): boolean {
  if (!target) return false;
  const targetRole = target.users?.roles?.role_name?.toUpperCase();
  const posName = typeof target.position === 'string' ? target.position : target.position?.name;
  const posLevel = typeof target.position === 'object' ? target.position?.level : undefined;

  return Boolean(
    targetRole === 'MANAGER' ||
    targetRole === 'ADMIN' ||
    posLevel === 'MANAGER' ||
    (posName && /quản lý|manager|trưởng phòng|giám đốc/i.test(posName)) ||
    (target.department?.name && /quản lý/i.test(target.department.name))
  );
}

export type EmployeeActor = { id?: string; role?: string; employee_id?: string | null; employeeId?: string | null };

/** Resolve the current database department, never a department or employee claim from a token. */
export async function getEmployeeScope(
  actor: EmployeeActor | undefined,
  mode: 'read' | 'manage' = 'read',
  tx?: Prisma.TransactionClient
): Promise<Prisma.EmployeeWhereInput> {
  if (!actor) throw AppError.unauthorized();
  const role = actor.role?.toUpperCase();
  if (role === 'ADMIN') return {};
  if (!actor.id || !['EMPLOYEE', 'MANAGER'].includes(role || '')) throw AppError.forbidden('Employee access denied');
  const client = tx ?? prisma;
  if (tx && mode === 'manage' && role === 'MANAGER') {
    await tx.$executeRaw`SELECT id FROM employees
      WHERE user_id::text = ${actor.id}
      OR department_id = (SELECT department_id FROM employees WHERE user_id::text = ${actor.id})
      ORDER BY id FOR UPDATE`;
  }
  const self = await client.employee.findFirst({ where: { user_id: actor.id } });
  if (!self) return { id: { in: [] } };
  if (role === 'EMPLOYEE' || !self.departmentId) return { id: { in: mode === 'read' ? [self.id] : [] } };
  const colleagues = await client.employee.findMany({
    where: { departmentId: self.departmentId },
    include: { position: true, department: true, users: { include: { roles: true } } },
  });
  const ids = colleagues.filter(employee => employee.id !== self.id && !isEmployeeManager(employee)).map(employee => employee.id);
  if (mode === 'read') ids.push(self.id);
  return { id: { in: ids } };
}

export async function assertCanAccessEmployeeDetail(
  actor: EmployeeActor | undefined,
  targetIdOrCode: string,
  forbiddenMessage = 'Employee access denied'
) {
  const scope = await getEmployeeScope(actor);
  if (actor?.role?.toUpperCase() === 'ADMIN') return;
  const target = await prisma.employee.findFirst({ where: { AND: [scope, buildIdOrCodeWhere(targetIdOrCode)] } });
  if (!target) throw AppError.forbidden(forbiddenMessage);
}

export async function assertCanManageEmployee(actor: EmployeeActor | undefined, targetIdOrCode: string, tx?: Prisma.TransactionClient) {
  const scope = await getEmployeeScope(actor, 'manage', tx);
  if (actor?.role?.toUpperCase() === 'ADMIN') return;
  const target = await (tx ?? prisma).employee.findFirst({ where: { AND: [scope, buildIdOrCodeWhere(targetIdOrCode)] } });
  if (!target) throw AppError.forbidden('Employee management denied');
}

/**
 * Chốt chặn phân quyền: Nguyên tắc bất kiêm nhiệm (Segregation of Duties).
 * Không ai được tự phê duyệt hoặc tự sửa dữ liệu kiểm soát của chính mình
 * (ca làm việc, ảnh khuôn mặt sinh trắc học, dữ liệu công/đi trễ).
 */
export function assertCannotModifySelfControlData(
  actor: { id?: string; role?: string } | undefined,
  targetEmployeeUserId: string | null | undefined,
  actionDescription: string
) {
  if (!actor) throw AppError.unauthorized();
  const role = actor.role?.toUpperCase();
  if (role === 'ADMIN') return; // Admin được phép quản trị toàn diện

  if (targetEmployeeUserId && actor.id && targetEmployeeUserId === actor.id) {
    throw AppError.forbidden(
      `Không ai được tự thực hiện hoặc tự sửa dữ liệu kiểm soát của chính mình (${actionDescription}). Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!`
    );
  }
}

/**
 * Chốt chặn: Manager không được chỉnh sửa hoặc can thiệp dữ liệu kiểm soát của Manager khác
 */
export function assertCannotModifyOtherManager(
  actor: { id?: string; role?: string } | undefined,
  target: {
    user_id?: string | null;
    position?: { name?: string | null; level?: string | null } | string | null;
    department?: { name?: string | null } | null;
    users?: { roles?: { role_name?: string | null } | null } | null;
  } | null | undefined,
  actionDescription: string
) {
  if (!actor) throw AppError.unauthorized();
  const role = actor.role?.toUpperCase();
  if (role === 'ADMIN') return;

  if (role === 'MANAGER' && isEmployeeManager(target)) {
    // Nếu target không phải chính mình mà là một Manager khác
    if (target?.user_id !== actor.id) {
      throw AppError.forbidden(`Quản lý không có quyền ${actionDescription} của quản lý khác!`);
    }
  }
}
