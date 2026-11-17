import { apiFetch } from '../../../api/client';
import { normalizeLoginResponse } from './authApi';

export interface FaceAttempt { attemptId: string; expiresAt: number; intervalMs: number }
export interface FaceFrameResult { seq: number; state: 'pending' | 'verified'; nextSeq: number; guidance: string }
export interface FaceAttemptStatus { state: string; nextSeq: number; expiresAt: number }

/** Non-2xx responses throw `ApiError` (with `statusCode`) from apiFetch; the capture loop branches on it. */
export { ApiError as FaceLoginHttpError } from '../../../api/client';

const base = '/api/auth/face-login';
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch<T>(`${base}${path}`, { method: 'POST', body: JSON.stringify(body), signal });
  if (!response.success || response.data === undefined) throw new Error(response.message || 'Không thể xác thực khuôn mặt.');
  return response.data as T;
}

export const faceLoginApi = {
  async config(signal?: AbortSignal) {
    const response = await apiFetch<{ enabled: boolean }>(`${base}/config`, { signal });
    return response.data?.enabled === true;
  },
  start(signal?: AbortSignal) { return post<FaceAttempt>('/attempts', {}, signal); },
  frame(attemptId: string, seq: number, frame: string, signal?: AbortSignal) {
    return post<FaceFrameResult>(`/attempts/${attemptId}/frames`, { seq, frame }, signal);
  },
  async status(attemptId: string, signal?: AbortSignal) {
    const response = await apiFetch<FaceAttemptStatus>(`${base}/attempts/${attemptId}`, { signal });
    if (!response.success || !response.data) throw new Error(response.message || 'Lượt nhận diện đã kết thúc.');
    return response.data;
  },
  async cancel(attemptId: string) {
    try { await apiFetch(`${base}/attempts/${attemptId}/cancel`, { method: 'POST', body: '{}' }); } catch { /* TTL backstop */ }
  },
  /** No AbortSignal on purpose: completion is not rolled back by aborting the request. */
  async complete(attemptId: string) {
    const response = await apiFetch(`${base}/attempts/${attemptId}/complete`, { method: 'POST', body: '{}' });
    return normalizeLoginResponse(response);
  },
  async passwordSession(password: string) {
    const response = await apiFetch(`${base}/password-session`, { method: 'POST', body: JSON.stringify({ password }) });
    if (!response.success) throw new Error(response.message || 'Không thể xác thực lại bằng mật khẩu.');
  },
};
