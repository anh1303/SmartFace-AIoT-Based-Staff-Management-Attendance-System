import { apiFetch } from './client';
import { logger } from '../utils/logger';

const departmentLogger = logger.child('DepartmentApi');

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

export async function fetchDepartmentsApi(): Promise<DepartmentItem[]> {
  try {
    const data = await apiFetch('/api/departments');
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (err) {
    departmentLogger.error('Lỗi khi tải danh sách phòng ban:', err);
    return [];
  }
}

export async function createDepartmentApi(data: { name: string; department_code?: string; description?: string }): Promise<DepartmentItem> {
  const res = await apiFetch('/api/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateDepartmentApi(id: number, data: { name?: string; description?: string }): Promise<DepartmentItem> {
  const res = await apiFetch(`/api/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteDepartmentApi(id: number): Promise<void> {
  await apiFetch(`/api/departments/${id}`, {
    method: 'DELETE',
  });
}
