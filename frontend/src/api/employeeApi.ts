import { apiFetch } from './client';
import { Employee } from '../types';

interface RawEmployee {
  id: string;
  employee_code?: string;
  employee_id?: string;
  full_name: string;
  department?: { name?: string } | string;
  position?: string;
  phone?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  face_embeddings?: unknown[];
  face_enrolled?: boolean;
  fingerprint_enrolled?: boolean;
  avatar_url?: string;
  avatar?: string;
  hourly_rate?: number | string;
}

export async function fetchEmployeesApi(): Promise<Employee[]> {
  const data = await apiFetch('/api/employees?limit=100');
  const dataObj = data.data as { items?: RawEmployee[] } | RawEmployee[] | undefined;
  const rawList: RawEmployee[] = Array.isArray(dataObj)
    ? dataObj
    : (Array.isArray(dataObj?.items) ? dataObj.items : []);

  if (data.success && rawList.length > 0) {
    return rawList.map((emp) => ({
      id: emp.id,
      employee_id: emp.employee_code || emp.employee_id || emp.id,
      full_name: emp.full_name,
      department: typeof emp.department === 'object' ? (emp.department?.name || 'Chung') : (emp.department || 'Chung'),
      position: emp.position || 'Nhân viên',
      phone: emp.phone || '',
      email: emp.email || '',
      status: emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      created_at: emp.createdAt || emp.created_at || new Date().toISOString(),
      updated_at: emp.updatedAt || emp.updated_at || new Date().toISOString(),
      face_enrolled: Array.isArray(emp.face_embeddings) ? emp.face_embeddings.length > 0 : Boolean(emp.face_enrolled),
      fingerprint_enrolled: Boolean(emp.fingerprint_enrolled),
      avatar: emp.avatar_url || emp.avatar || undefined,
      hourly_rate: emp.hourly_rate ? Number(emp.hourly_rate) : undefined,
    }));
  }
  return [];
}

export async function createEmployeeApi(newEmp: Omit<Employee, 'created_at' | 'updated_at'>) {
  const res = await apiFetch('/api/employees', {
    method: 'POST',
    body: JSON.stringify({
      employee_code: newEmp.employee_id,
      full_name: newEmp.full_name,
      email: newEmp.email,
      position: newEmp.position,
      phone: newEmp.phone,
      department: newEmp.department,
      hourly_rate: newEmp.hourly_rate || 0,
    }),
  });
  return res.data;
}

export async function updateEmployeeApi(id: string, updates: Partial<Employee>) {
  const res = await apiFetch(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      full_name: updates.full_name,
      email: updates.email,
      position: updates.position,
      phone: updates.phone,
      department: updates.department,
      status: updates.status,
      hourly_rate: updates.hourly_rate,
      avatar_url: updates.avatar,
    }),
  });
  return res.data;
}
