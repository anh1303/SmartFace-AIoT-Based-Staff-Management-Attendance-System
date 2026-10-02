export interface Employee {
  id?: string;
  employee_id: string;      // "NV001"
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
