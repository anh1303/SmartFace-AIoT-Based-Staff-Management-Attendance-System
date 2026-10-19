import { apiFetch } from './client';
import { logger } from '../utils/logger';

const positionLogger = logger.child('PositionApi');

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

export async function fetchPositionsApi(): Promise<PositionItem[]> {
  try {
    const data = await apiFetch('/api/positions');
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (err) {
    positionLogger.error('Lỗi khi tải danh sách chức vụ:', err);
    return [];
  }
}

export interface CreatePositionPayload {
  name: string;
  department_id?: number;
  level?: 'MANAGER' | 'EMPLOYEE';
  position_code?: string;
}

export interface UpdatePositionPayload {
  name?: string;
  department_id?: number;
  level?: 'MANAGER' | 'EMPLOYEE';
}

export async function createPositionApi(
  payload: string | CreatePositionPayload
): Promise<PositionItem> {
  const body = typeof payload === 'string' ? { name: payload.trim() } : payload;
  const res = await apiFetch('/api/positions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updatePositionApi(
  id: number,
  payload: string | UpdatePositionPayload
): Promise<PositionItem> {
  const body = typeof payload === 'string' ? { name: payload.trim() } : payload;
  const res = await apiFetch(`/api/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deletePositionApi(id: number): Promise<void> {
  await apiFetch(`/api/positions/${id}`, {
    method: 'DELETE',
  });
}

