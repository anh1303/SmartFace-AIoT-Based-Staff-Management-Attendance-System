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
