import { apiFetch } from '../../../api/client';
import { normalizeLoginResponse } from './authApi';

export interface FaceChallenge { challengeId: string; expiresAt: number }

export const faceLoginApi = {
  async config(signal?: AbortSignal) {
    const response = await apiFetch<{ enabled: boolean }>('/api/auth/face-login/config', { signal });
    return response.data?.enabled === true;
  },
  async challenge(signal?: AbortSignal): Promise<FaceChallenge> {
    const response = await apiFetch<FaceChallenge>('/api/auth/face-login/challenges', { method: 'POST', signal });
    if (!response.success || !response.data) throw new Error('Chưa bắt đầu được nhận diện. Vui lòng thử lại.');
    return response.data;
  },
  async login(challengeId: string, frames: string[], signal?: AbortSignal) {
    const response = await apiFetch('/api/auth/face-login', { method: 'POST',
      body: JSON.stringify({ challengeId, frames }), signal });
    return normalizeLoginResponse(response);
  },
  async passwordSession(password: string) {
    const response = await apiFetch('/api/auth/face-login/password-session', {
      method: 'POST', body: JSON.stringify({ password }),
    });
    if (!response.success) throw new Error(response.message || 'Không thể xác thực lại bằng mật khẩu.');
  },
};
