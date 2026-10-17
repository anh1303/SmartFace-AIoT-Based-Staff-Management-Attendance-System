import { apiFetch } from './client';
import { UserSession, Role } from '../types';

export const DEFAULT_USERS: Record<Role, UserSession> = {
  admin: {
    employee_id: 'ADMIN',
    full_name: 'Quản trị viên',
    email: 'admin@aiot.corp',
    role: 'admin',
    role_name: 'ADMIN',
    is_manager: true,
    position: 'Quản trị hệ thống',
    department: 'Ban Quản Trị',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  manager: {
    employee_id: 'NV-001',
    full_name: 'Nguyễn Văn A',
    email: 'anv@aiot.corp',
    role: 'manager',
    role_name: 'MANAGER',
    is_manager: true,
    position: 'Trưởng phòng Nhân sự',
    positionId: 1,
    department: 'Nhân sự',
    departmentId: 1,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  employee: {
    employee_id: 'NV-002',
    full_name: 'Lê Hoàng Phúc',
    email: 'employee@company.com',
    role: 'employee',
    role_name: 'EMPLOYEE',
    is_manager: false,
    position: 'Thu ngân chính',
    positionId: 2,
    department: 'Nhân sự',
    departmentId: 1,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
};

export async function loginApi(identifier: string, password?: string) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });

  if (res.success && res.data) {
    const { user } = res.data;
    const roleName = (user.role_name || user.role || '').toUpperCase();
    let targetRole: Role = 'employee';
    if (roleName === 'ADMIN') {
      targetRole = 'admin';
    } else if (roleName === 'MANAGER' || user.is_manager) {
      targetRole = 'manager';
    } else {
      targetRole = 'employee';
    }

    const isManagerOrAdmin = targetRole === 'admin' || targetRole === 'manager';

    const session: UserSession = {
      employee_id: user.employee_id || user.username || (targetRole === 'admin' ? 'ADMIN' : 'EMP-001'),
      full_name: user.full_name || user.username,
      email: user.email || '',
      role: targetRole,
      role_name: roleName || targetRole.toUpperCase(),
      is_manager: isManagerOrAdmin,
      position: user.position || (targetRole === 'admin' ? 'Quản trị viên' : targetRole === 'manager' ? 'Quản lý' : 'Nhân viên'),
      positionId: user.positionId ?? user.position_id ?? null,
      department: user.department || (targetRole === 'admin' ? 'Ban Quản Trị' : 'Chung'),
      departmentId: user.departmentId ?? user.department_id ?? null,
      avatar: user.avatar || DEFAULT_USERS[targetRole].avatar,
    };

    return { session, targetRole };
  }

  throw new Error(res.message || 'Xác thực thất bại!');
}

export async function logoutApi() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function meApi(): Promise<UserSession | null> {
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.success && res.data) {
      const user = res.data;
      const roleName = (user.role_name || user.role || '').toUpperCase();
      let targetRole: Role = 'employee';
      if (roleName === 'ADMIN') {
        targetRole = 'admin';
      } else if (roleName === 'MANAGER' || user.is_manager) {
        targetRole = 'manager';
      } else {
        targetRole = 'employee';
      }

      const isManagerOrAdmin = targetRole === 'admin' || targetRole === 'manager';

      return {
        employee_id: user.employee_id || user.username || (targetRole === 'admin' ? 'ADMIN' : 'EMP-001'),
        full_name: user.full_name || user.username,
        email: user.email || '',
        role: targetRole,
        role_name: roleName || targetRole.toUpperCase(),
        is_manager: isManagerOrAdmin,
        position: user.position || (targetRole === 'admin' ? 'Quản trị viên' : targetRole === 'manager' ? 'Quản lý' : 'Nhân viên'),
        positionId: user.positionId ?? user.position_id ?? null,
        department: user.department || (targetRole === 'admin' ? 'Ban Quản Trị' : 'Chung'),
        departmentId: user.departmentId ?? user.department_id ?? null,
        avatar: user.avatar || DEFAULT_USERS[targetRole].avatar,
      };
    }
  } catch {
    // Cookie invalid or not present
  }
  return null;
}
