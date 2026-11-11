import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiFetch } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import type { FingerprintStep } from '../components/FingerprintEnrollmentSection';

export interface FingerprintSession {
  id: string; employee_id: string; device_id: string; finger_name: string;
  status: FingerprintStep; match_score: number | null; error: string | null; expires_at: string;
}
export interface FingerprintDevice {
  device_id: string; ready: boolean; wak_verified: boolean; roundtrip_verified: boolean;
  enrollment_active?: boolean;
  capacity: number; attendance_enabled: boolean; polling_fallback: boolean; last_seen: string; error: string | null;
}
const terminal = ['COMPLETED','CANCELLED','EXPIRED','FAILED'];
export function useFingerprintEnrollment(employeeId: string | undefined, blocked: boolean, toast: (message: string, type: any) => void) {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const storageKey = `fingerprint-session:${currentUser?.username}:${employeeId}`;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const key = ['fingerprint-session', currentUser?.username, employeeId, sessionId];
  const requestKey = useRef<string | null>(null);
  const latest = useRef(storageKey); latest.current = storageKey;
  useEffect(() => {
    requestKey.current = null;
    const stored = sessionStorage.getItem(storageKey);
    // Don't auto-restore terminal sessions from storage
    if (stored) {
      setSessionId(stored);
    } else {
      setSessionId(null);
    }
  }, [storageKey]);
  const devices = useQuery({ queryKey: ['fingerprint-devices',currentUser?.username], enabled: Boolean(currentUser),
    queryFn: async () => (await apiFetch<FingerprintDevice[]>('/api/biometrics/fingerprint-devices')).data || [], refetchInterval: 15000, staleTime: 10000 });
  const recover = useQuery({ queryKey: ['fingerprint-current', currentUser?.username, employeeId], enabled: Boolean(employeeId && !blocked),
    queryFn: async () => (await apiFetch<FingerprintSession | null>(`/api/biometrics/${employeeId}/fingerprint/sessions/current`)).data });
  useEffect(() => {
    if (recover.isSuccess) {
      if (recover.data && !terminal.includes(recover.data.status)) {
        sessionStorage.setItem(storageKey, recover.data.id);
        setSessionId(recover.data.id);
      } else {
        sessionStorage.removeItem(storageKey);
        setSessionId(null);
      }
    }
  }, [recover.isSuccess, recover.data, storageKey]);
  const session = useQuery({ queryKey: key, enabled: Boolean(employeeId && sessionId), retry: 1,
    queryFn: async ({ signal }) => (await apiFetch<FingerprintSession>(`/api/biometrics/${employeeId}/fingerprint/sessions/${sessionId}`, { signal })).data,
    refetchInterval: query => terminal.includes(query.state.data?.status || '') ? false : 2000 });
  useEffect(() => {
    if (session.data?.status && terminal.includes(session.data.status)) {
      sessionStorage.removeItem(storageKey);
      void client.invalidateQueries({ queryKey: ['fingerprint-devices', currentUser?.username] });
    }
  }, [session.data?.status, storageKey]);
  useEffect(() => {
    if (!sessionId) return;
    const socket = io(`${import.meta.env.VITE_SOCKET_URL || window.location.origin}/fingerprint`, { withCredentials: true });
    const refresh = () => { void client.invalidateQueries({ queryKey: key }); };
    socket.on('connect', refresh);
    socket.on('progress', (progress: FingerprintSession) => { if (progress.id === sessionId) refresh(); });
    return () => { socket.disconnect(); };
  }, [employeeId, sessionId, currentUser?.username]);
  useEffect(() => {
    if (session.data?.status === 'COMPLETED') {
      void client.invalidateQueries({ queryKey: ['employees'] });
      void client.invalidateQueries({ queryKey: ['biometrics'] });
    }
  }, [session.data?.status]);
  async function start(device_id: string, finger_name: string) {
    if (blocked || !employeeId || sending) return;
    const forEmployee = storageKey;
    setSending(true);
    requestKey.current ||= crypto.randomUUID();
    try {
      const result = (await apiFetch<FingerprintSession>(`/api/biometrics/${employeeId}/fingerprint/sessions`, {
        method: 'POST', headers: { 'Idempotency-Key': requestKey.current }, body: JSON.stringify({ device_id, finger_name }),
      })).data!;
      sessionStorage.setItem(forEmployee, result.id);
      if (latest.current === forEmployee) setSessionId(result.id);
      requestKey.current = null;
    } catch (e: any) { toast(e.message || 'Chưa xác nhận được phiên lấy mẫu; gửi lại để kiểm tra cùng yêu cầu.', 'error'); }
    finally { setSending(false); }
  }
  async function confirm() {
    if (!session.data || blocked || sending) return false;
    setSending(true);
    const confirmKey = `fingerprint-confirm:${session.data.id}`;
    const idempotency = sessionStorage.getItem(confirmKey) || crypto.randomUUID();
    sessionStorage.setItem(confirmKey, idempotency);
    try {
      await apiFetch(`/api/biometrics/${employeeId}/fingerprint/sessions/${session.data.id}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': idempotency } });
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(confirmKey);
      setSessionId(null);
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: ['fingerprint-current', currentUser?.username, employeeId] });
      toast('Đã xác nhận mẫu; đang chờ Pi đồng bộ. Mẫu cũ tiếp tục có hiệu lực.', 'info');
      return true;
    } catch (e: any) { toast(e.message, 'error'); throw e; }
    finally { setSending(false); }
  }
  async function cancel() {
    if (!sessionId || blocked || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/biometrics/${employeeId}/fingerprint/sessions/${sessionId}/cancel`, { method: 'POST' });
      sessionStorage.removeItem(storageKey);
      setSessionId(null);
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: ['fingerprint-current', currentUser?.username, employeeId] });
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSending(false); }
  }
  function reset() {
    sessionStorage.removeItem(storageKey);
    setSessionId(null);
  }
  return { devices: devices.data || [], devicesError: devices.error?.message,
    session: session.data, error: session.error?.message || (session.data?.status === 'FAILED' ? session.data?.error : null),
    step: (sending ? 'SENDING' : (sessionId && session.data ? session.data.status : 'IDLE')) as FingerprintStep,
    sending, start, confirm, cancel, reset };
}
