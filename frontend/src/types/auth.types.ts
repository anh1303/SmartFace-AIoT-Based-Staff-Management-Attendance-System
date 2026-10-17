export type Role = 'admin' | 'manager' | 'employee';

export interface UserSession {
  employee_id: string;
  full_name: string;
  email: string;
  role: Role;
  role_name?: string;
  is_manager?: boolean;
  position: string;
  positionId?: number | null;
  department: string;
  departmentId?: number | null;
  avatar: string;
}

export interface LoginPayload {
  identifier: string;
  password?: string;
}

export interface LoginResult {
  session: UserSession;
  targetRole: Role;
}
