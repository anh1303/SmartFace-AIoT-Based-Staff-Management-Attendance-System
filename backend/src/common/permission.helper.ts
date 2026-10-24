import { prisma } from '../config/database.js';
import { AppError } from './AppError.js';
import { buildIdOrCodeWhere } from './utils.js';

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

/**
 * Kiểm tra phân quyền truy cập hồ sơ nhân viên:
 * 1. ADMIN: Có tất cả quyền, truy cập được toàn bộ hồ sơ.
 * 2. EMPLOYEE: Chỉ có thể xem thông tin của chính mình.
 * 3. MANAGER (Quản lý): Có thể xem hồ sơ nhân viên thông thường và chính mình,
 *    nhưng KHÔNG ĐƯỢC xem hồ sơ chi tiết của các Manager (Quản lý) khác.
 */
export async function assertCanAccessEmployeeDetail(
  user: { id?: string; role?: string; employee_id?: string | null; employeeId?: string | null } | undefined,
  targetIdOrCode: string,
  customForbiddenMessage = 'Bạn không có quyền xem thông tin chi tiết của quản lý khác'
) {
  if (!user) {
    throw AppError.unauthorized();
  }

  const role = user.role?.toUpperCase();

  // 1. ADMIN có tất cả quyền
  if (role === 'ADMIN') {
    return;
  }

  // 2. EMPLOYEE chỉ xem được chính mình
  if (role === 'EMPLOYEE') {
    const selfEmp = await prisma.employee.findFirst({
      where: { user_id: user.id },
    });
    if (!selfEmp) {
      throw AppError.notFound('Không tìm thấy thông tin hồ sơ nhân viên của bạn');
    }
    const isSelf = selfEmp.id === targetIdOrCode || selfEmp.employee_code === targetIdOrCode;
    if (!isSelf) {
      throw AppError.forbidden('Bạn không có quyền xem thông tin của nhân viên khác');
    }
    return;
  }

  // 3. MANAGER: Không thể xem chi tiết của Quản lý khác
  if (role === 'MANAGER') {
    const target = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(targetIdOrCode),
      include: {
        department: true,
        users: {
          select: {
            id: true,
            roles: { select: { role_name: true } },
          },
        },
      },
    });

    if (!target) {
      throw AppError.notFound('Không tìm thấy thông tin nhân viên');
    }

    // Kiểm tra có phải chính mình không
    const selfEmp = await prisma.employee.findFirst({
      where: { user_id: user.id },
    });
    const isSelf =
      (selfEmp && (selfEmp.id === target.id || selfEmp.employee_code === target.employee_code)) ||
      target.user_id === user.id;

    if (isSelf) {
      return; // Quản lý được xem chính mình
    }

    // Chốt chặn: Quản lý chỉ được xem nhân viên thuộc phòng ban mình phụ trách
    if (selfEmp?.departmentId && target.departmentId && selfEmp.departmentId !== target.departmentId) {
      throw AppError.forbidden('Quản lý chỉ có quyền xem thông tin nhân viên thuộc phòng ban mình phụ trách');
    }

    // Kiểm tra nhân viên mục tiêu có phải là Quản lý không
    if (isEmployeeManager(target)) {
      throw AppError.forbidden(customForbiddenMessage);
    }
  }
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
    position?: string | null;
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
