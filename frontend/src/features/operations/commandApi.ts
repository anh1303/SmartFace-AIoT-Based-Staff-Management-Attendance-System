import { ApiError, apiFetch } from '../../api/client';
import type { Operation } from './OperationsProvider';
export class UncertainWriteError extends Error {}

// Only a digest and request ID are persisted. Images, credentials and form contents stay out of storage.
export async function commandKey(endpoint: string, body: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${endpoint}:${JSON.stringify(body)}`));
  const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const storageKey = `smartface_pending_command:${digest}`;
  const existing = sessionStorage.getItem(storageKey);
  const key = existing || crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return { key, storageKey };
}
export const definitiveFailure = (error: unknown) => error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500;

export async function submitBackgroundCommand(endpoint: string, body: unknown): Promise<Operation> {
  const request = await commandKey(endpoint, body);
  try {
    const response = await apiFetch<Operation>(endpoint, { method: 'POST', headers: { 'Idempotency-Key': request.key }, body: JSON.stringify(body) });
    sessionStorage.removeItem(request.storageKey);
    return response.data!;
  } catch (error) {
    if (definitiveFailure(error)) { sessionStorage.removeItem(request.storageKey); throw error; }
    try {
      const response = await apiFetch<Operation>(`/api/operations/by-key/${request.key}`);
      sessionStorage.removeItem(request.storageKey);
      return response.data!;
    } catch {
      throw new UncertainWriteError('Chưa xác định máy chủ đã nhận yêu cầu hay chưa. Kiểm tra bảng Hoạt động; nếu gửi lại cùng nội dung, hệ thống dùng lại mã thao tác để tránh chạy trùng.');
    }
  }
}
