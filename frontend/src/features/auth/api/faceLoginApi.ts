import { apiFetch } from '../../../api/client';
import { normalizeLoginResponse } from './authApi';
import { FACE_LOGIN_TIMEOUTS, withBoundedSignal } from '../lib/faceLoginRequest';

export interface FaceAttempt { attemptId: string; expiresAt: number; remainingMs: number; intervalMs: number }
export interface FaceFrameResult { seq: number; state: 'pending' | 'verified'; nextSeq: number; guidance: string }
export interface FaceAttemptStatus { state: string; nextSeq: number; expiresAt: number; remainingMs: number }

/** Non-2xx responses throw `ApiError` (with `statusCode`) from apiFetch; the capture loop branches on it. */
export { ApiError as FaceLoginHttpError } from '../../../api/client';

const base = '/api/auth/face-login';
async function post<T>(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return withBoundedSignal(timeoutMs, signal, async (boundedSignal) => {
    const response = await apiFetch<T>(`${base}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: boundedSignal,
    });
    if (!response.success || response.data === undefined) {
      throw new Error(response.message || 'Không thể xác thực khuôn mặt.');
    }
    return response.data as T;
  });
}

export const faceLoginApi = {
  async config(signal?: AbortSignal) {
    return withBoundedSignal(FACE_LOGIN_TIMEOUTS.CONFIG_MS, signal, async (boundedSignal) => {
      const response = await apiFetch<{ enabled: boolean }>(`${base}/config`, { signal: boundedSignal });
      return response.data?.enabled === true;
    });
  },
  start(signal?: AbortSignal) {
    return post<FaceAttempt>('/attempts', {}, FACE_LOGIN_TIMEOUTS.START_MS, signal);
  },
  frame(attemptId: string, seq: number, frame: string, signal?: AbortSignal, remainingMs?: number) {
    const timeoutMs = remainingMs !== undefined
      ? Math.min(FACE_LOGIN_TIMEOUTS.FRAME_MS, Math.max(1, remainingMs))
      : FACE_LOGIN_TIMEOUTS.FRAME_MS;
    return post<FaceFrameResult>(`/attempts/${attemptId}/frames`, { seq, frame }, timeoutMs, signal);
  },
  async status(attemptId: string, signal?: AbortSignal) {
    return withBoundedSignal(FACE_LOGIN_TIMEOUTS.STATUS_MS, signal, async (boundedSignal) => {
      const response = await apiFetch<FaceAttemptStatus>(`${base}/attempts/${attemptId}`, { signal: boundedSignal });
      if (!response.success || !response.data) throw new Error(response.message || 'Lượt nhận diện đã kết thúc.');
      return response.data;
    });
  },
  async cancel(attemptId: string, signal?: AbortSignal) {
    try {
      await withBoundedSignal(FACE_LOGIN_TIMEOUTS.CANCEL_MS, signal, async (boundedSignal) => {
        await apiFetch(`${base}/attempts/${attemptId}/cancel`, {
          method: 'POST',
          body: '{}',
          signal: boundedSignal,
        });
      });
    } catch { /* TTL backstop */ }
  },
  /** Accepts an optional AbortSignal to bound waiting time; aborting stops waiting, not server commit. */
  async complete(attemptId: string, signal?: AbortSignal) {
    return withBoundedSignal(FACE_LOGIN_TIMEOUTS.COMPLETE_POST_MS, signal, async (boundedSignal) => {
      const response = await apiFetch(`${base}/attempts/${attemptId}/complete`, {
        method: 'POST',
        body: '{}',
        signal: boundedSignal,
      });
      return normalizeLoginResponse(response);
    });
  },
  async passwordSession(password: string) {
    const response = await apiFetch(`${base}/password-session`, { method: 'POST', body: JSON.stringify({ password }) });
    if (!response.success) throw new Error(response.message || 'Không thể xác thực lại bằng mật khẩu.');
  },
};
