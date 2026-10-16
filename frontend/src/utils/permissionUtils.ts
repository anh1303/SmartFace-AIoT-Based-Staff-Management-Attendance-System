import { Employee, UserSession } from '../types';

/**
 * Kiểm tra xem một nhân viên có phải là "Quản lý khác" đối với người dùng đang đăng nhập hay không.
 *
 * Quy tắc phân quyền:
 * 1. Admin: Có tất cả các quyền -> Không bị hạn chế (trả về false).
 * 2. Người dùng không phải là Quản lý -> Không áp dụng hạn chế này (trả về false).
 * 3. Nếu nhân viên mục tiêu chính là người dùng đang đăng nhập (self) -> Được phép xem chính mình (trả về false).
 * 4. Nếu nhân viên mục tiêu có vai trò hoặc chức vụ là Quản lý (Manager) -> Trả về true (Bị chặn xem chi tiết).
 */
export function isAnotherManager(
  targetEmp: Employee | null | undefined,
  currentUser: UserSession | null | undefined
): boolean {
  if (!targetEmp || !currentUser) return false;

  // 1. Admin có tất cả quyền
  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.role_name?.toUpperCase() === 'ADMIN';

  if (isAdmin) {
    return false;
  }

  // 2. Chỉ áp dụng kiểm tra khi người dùng hiện tại là Quản lý (Manager)
  const isCurrentManager =
    currentUser.role === 'manager' ||
    currentUser.role_name?.toUpperCase() === 'MANAGER' ||
    Boolean(currentUser.is_manager);

  if (!isCurrentManager) {
    return false;
  }

  // 3. Nếu chính là người dùng hiện tại -> Được phép xem
  const isSelf =
    targetEmp.employee_id === currentUser.employee_id ||
    targetEmp.id === currentUser.employee_id;

  if (isSelf) {
    return false;
  }

  // 4. Kiểm tra nhân viên mục tiêu có phải là Quản lý hay không
  const targetRole = targetEmp.role?.toUpperCase();
  const targetIsManager = Boolean(
    targetEmp.is_manager ||
    targetRole === 'MANAGER' ||
    targetRole === 'ADMIN' ||
    (targetEmp.position && /quản lý|manager|trưởng phòng/i.test(targetEmp.position)) ||
    (targetEmp.department && /quản lý/i.test(targetEmp.department))
  );

  return targetIsManager;
}
