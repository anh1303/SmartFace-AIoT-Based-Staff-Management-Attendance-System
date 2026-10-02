import { apiFetch } from './client';
import { logger } from '../utils/logger';

const positionLogger = logger.child('PositionApi');

export interface PositionItem {
  id: number;
  department_code: string;
  name: string;
  employee_count: number;
  created_at?: string;
}

export async function fetchPositionsApi(): Promise<PositionItem[]> {
  try {
    const data = await apiFetch('/api/departments');
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (err) {
    positionLogger.error('Lỗi khi tải danh sách chức vụ:', err);
    return [];
  }
}

export async function createPositionApi(name: string): Promise<PositionItem> {
  const res = await apiFetch('/api/departments', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
  });
  return res.data;
}

export async function updatePositionApi(id: number, name: string): Promise<PositionItem> {
  const res = await apiFetch(`/api/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: name.trim() }),
  });
  return res.data;
}

export async function deletePositionApi(id: number): Promise<void> {
  await apiFetch(`/api/departments/${id}`, {
    method: 'DELETE',
  });
}
