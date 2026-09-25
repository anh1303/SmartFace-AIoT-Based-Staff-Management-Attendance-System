import { apiFetch } from './client';
import { UserSession, Role } from '../types';

export const DEFAULT_USERS: Record<Role, UserSession> = {
  manager: {
    employee_id: 'NV-001',
    full_name: 'Nguyễn Văn A',
    email: 'anv@aiot.corp',
    role: 'manager',
    position: 'Quản lý chính',
    department: 'Quản lý',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  employee: {
    employee_id: 'NV-002',
    full_name: 'Lê Hoàng Phúc',
    email: 'employee@company.com',
    role: 'employee',
    position: 'Thu ngân chính',
    department: 'Thu ngân',
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
    const isManager = Boolean(
      user.is_manager ||
      user.role === 'ADMIN' ||
      user.role === 'MANAGER' ||
      user.role === 'manager' ||
      user.role_name === 'ADMIN' ||
      user.role_name === 'MANAGER'
    );
    const targetRole: Role = isManager ? 'manager' : 'employee';

    const session: UserSession = {
      employee_id: user.employee_id || user.username || 'EMP-001',
      full_name: user.full_name || user.username,
      email: user.email || '',
      role: targetRole,
      role_name: user.role_name || user.role,
      is_manager: isManager,
      position: user.position || (targetRole === 'manager' ? 'Manager' : 'Employee'),
      department: user.department || 'Chung',
      avatar: user.avatar || (targetRole === 'manager' ? DEFAULT_USERS.manager.avatar : DEFAULT_USERS.employee.avatar),
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
      const isManager = Boolean(
        user.is_manager ||
        user.role === 'ADMIN' ||
        user.role === 'MANAGER' ||
        user.role === 'manager' ||
        user.role_name === 'ADMIN' ||
        user.role_name === 'MANAGER'
      );
      const targetRole: Role = isManager ? 'manager' : 'employee';

      return {
        employee_id: user.employee_id || user.username || 'EMP-001',
        full_name: user.full_name || user.username,
        email: user.email || '',
        role: targetRole,
        role_name: user.role_name || user.role,
        is_manager: isManager,
        position: user.position || (targetRole === 'manager' ? 'Manager' : 'Employee'),
        department: user.department || 'Chung',
        avatar: user.avatar || (targetRole === 'manager' ? DEFAULT_USERS.manager.avatar : DEFAULT_USERS.employee.avatar),
      };
    }
  } catch {
    // Cookie invalid or not present
  }
  return null;
}
