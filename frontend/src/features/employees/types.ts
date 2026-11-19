export interface Employee {
  id?: string;
  employee_id: string;      // "NV001"
  username?: string;
  full_name: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  face_enrolled: boolean;
  fingerprint_enrolled: boolean;
  avatar?: string;
  hourly_rate?: number;
  role?: string;
  is_manager?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  created_at?: string;
}

export interface Position {
  id: string;
  title: string;
  department_id?: string;
  base_rate?: number;
}

export interface DepartmentItem {
  id: number;
  department_code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  employee_count: number;
  position_count?: number;
  created_at?: string;
}

export interface PositionItem {
  id: number;
  position_code?: string;
  department_code: string;
  name: string;
  employee_count: number;
  created_at?: string;
  level?: 'MANAGER' | 'EMPLOYEE';
  department_id?: number;
  department_name?: string;
}
