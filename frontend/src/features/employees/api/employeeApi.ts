import { apiFetch } from '../../../api/client';
import { Employee } from '../../../types';
import { commandKey, definitiveFailure, UncertainWriteError } from '../../operations/commandApi';

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

export function mapEmployee(emp: RawEmployee): Employee {
  return {
    id: emp.id, employee_id: emp.employee_code || emp.employee_id || emp.id,
    full_name: emp.full_name,
    department: typeof emp.department === 'object' ? (emp.department?.name || 'Chung') : (emp.department || 'Chung'),
    position: emp.position || 'Nhân viên', phone: emp.phone || '', email: emp.email || '',
    status: emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    created_at: emp.createdAt || emp.created_at || new Date().toISOString(),
    updated_at: emp.updatedAt || emp.updated_at || new Date().toISOString(),
    face_enrolled: Array.isArray(emp.face_embeddings) ? emp.face_embeddings.length > 0 : Boolean(emp.face_enrolled),
    fingerprint_enrolled: Boolean(emp.fingerprint_enrolled), avatar: emp.avatar_url || emp.avatar || undefined,
    hourly_rate: emp.hourly_rate !== undefined ? Number(emp.hourly_rate) : undefined,
  };
}

export async function fetchEmployeesApi(): Promise<Employee[]> {
  const allRaw: RawEmployee[] = [];
  let page = 1;
  const limit = 100;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await apiFetch(`/api/employees?page=${page}&limit=${limit}`);
    if (!data.success || !data.data) break;

    const dataObj = data.data as { items?: RawEmployee[]; pagination?: { totalPages?: number } } | RawEmployee[];
    if (Array.isArray(dataObj)) {
      allRaw.push(...dataObj);
      break;
    } else {
      const items = Array.isArray(dataObj.items) ? dataObj.items : [];
      allRaw.push(...items);
      totalPages = dataObj.pagination?.totalPages ?? 1;
      if (items.length === 0 || page >= totalPages) break;
      page++;
    }
  }

  if (allRaw.length > 0) {
    return allRaw.map((emp) => ({
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
  const body = {
      employee_code: newEmp.employee_id,
      full_name: newEmp.full_name,
      email: newEmp.email,
      position: newEmp.position,
      phone: newEmp.phone,
      department: newEmp.department,
      hourly_rate: newEmp.hourly_rate || 0,
  };
  const request = await commandKey('/api/employees', body);
  try {
    const res = await apiFetch('/api/employees', { method: 'POST', headers: { 'Idempotency-Key': request.key }, body: JSON.stringify(body) });
    sessionStorage.removeItem(request.storageKey);
    return { employee: mapEmployee(res.data), emailStatus: res.data.email_status };
  } catch (error) {
    if (definitiveFailure(error)) { sessionStorage.removeItem(request.storageKey); throw error; }
    try {
      const confirmation = await apiFetch(`/api/operations/by-key/${request.key}`);
      const res = await apiFetch(`/api/employees/${confirmation.data.result.employeeId}`);
      sessionStorage.removeItem(request.storageKey);
      return { employee: mapEmployee(res.data), emailStatus: 'queued' };
    } catch {
      throw new UncertainWriteError('Chưa xác định nhân viên đã được tạo hay chưa. Thử lại cùng nội dung để kiểm tra bằng mã yêu cầu cũ, tránh tạo trùng.');
    }
  }
}

export async function updateEmployeeApi(id: string, updates: Partial<Employee>) {
  try {
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
      fingerprint_enrolled: updates.fingerprint_enrolled,
      expectedVersion: updates.updated_at,
    }),
  });
  return mapEmployee(res.data);
  } catch (error) {
    if (definitiveFailure(error)) throw error;
    try {
      const response = await apiFetch(`/api/employees/${id}`);
      const employee = mapEmployee(response.data);
      const fields = Object.entries(updates).filter(([key, value]) => key !== 'updated_at' && value !== undefined);
      if (fields.length && fields.every(([key, value]) => employee[key as keyof Employee] === value)) return employee;
    } catch { /* A failed reconciliation is an unknown outcome, not proof of rollback. */ }
    throw new UncertainWriteError('Chưa xác định thay đổi đã được lưu hay chưa. Đang tải lại dữ liệu từ máy chủ; vui lòng kiểm tra trước khi sửa tiếp.');
  }
}

export async function deleteEmployeeApi(id: string) {
  const res = await apiFetch(`/api/employees/${id}`, {
    method: 'DELETE',
  });
  return res.data;
}

export async function resetEmployeePasswordApi(id: string) {
  const res = await apiFetch(`/api/employees/${id}/reset-password`, {
    method: 'POST',
  });
  return res.data;
}

