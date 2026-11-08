import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiFetch } from '../../../api/client';
import type { Employee } from '../../../types';
import { useAuth, getActiveSessionId } from '../../../context/AuthContext';
import type { FingerprintStep } from '../components/FingerprintEnrollmentSection';

export interface FingerprintSession {
  id: string; employee_id: string; device_id: string; finger_name: string;
  status: FingerprintStep; match_score: number | null; error: string | null; expires_at: string;
}
export interface FingerprintDevice {
  device_id: string; ready: boolean; wak_verified: boolean; roundtrip_verified: boolean;
  capacity: number; attendance_enabled: boolean; polling_fallback: boolean; last_seen: string; error: string | null;
}
const terminal = ['COMPLETED','CANCELLED','EXPIRED','FAILED'];
export function useFingerprintEnrollment(employeeId: string | undefined, blocked: boolean, toast: (message: string, type: any, title?: string) => void) {
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
    queryFn: async () => (await apiFetch<FingerprintDevice[]>('/api/biometrics/fingerprint-devices')).data || [], refetchInterval: 30000, staleTime: 15000 });
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
    } catch (e: any) { toast(e.message || 'Chưa xác nhận được phiên lấy mẫu; gửi lại để kiểm tra cùng yêu cầu.', 'error', "Không thể lấy mẫu vân tay"); }
    finally { setSending(false); }
  }
  async function confirm() {
    if (!session.data || blocked || sending) return false;
    setSending(true);
    const confirmKey = `fingerprint-confirm:${session.data.id}`;
    const idempotency = sessionStorage.getItem(confirmKey) || crypto.randomUUID();
    sessionStorage.setItem(confirmKey, idempotency);
    try {
      const activeSession = getActiveSessionId();
      let result = (await apiFetch<FingerprintSession>(`/api/biometrics/${employeeId}/fingerprint/sessions/${session.data.id}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': idempotency } })).data!;
      const deadline = Date.now() + 180_000;
      let failures = 0;
      while (result.status === 'SYNCING') {
        if (getActiveSessionId() !== activeSession) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.');
        if (Date.now() > deadline) throw new Error('Pi chưa xác nhận đồng bộ. Mẫu cũ vẫn có hiệu lực; thử xác nhận lại để kiểm tra phiên hiện tại.');
        await new Promise(resolve => window.setTimeout(resolve, 1500));
        try {
          result = (await apiFetch<FingerprintSession>(`/api/biometrics/${employeeId}/fingerprint/sessions/${session.data.id}`)).data!;
          failures = 0;
        } catch {
          if (++failures >= 3) throw new Error('Mất kết nối khi chờ Pi. Thử xác nhận lại để kiểm tra phiên hiện tại.');
        }
      }
      if (getActiveSessionId() !== activeSession) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.');
      if (result.status !== 'COMPLETED') throw new Error(result.error || 'Chưa đồng bộ được mẫu vân tay. Vui lòng kiểm tra thiết bị.');
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(confirmKey);
      setSessionId(null);
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: ['fingerprint-current', currentUser?.username, employeeId] });
      await client.invalidateQueries({ queryKey: ['employees'] });
      await client.invalidateQueries({ queryKey: ['biometrics'] });
      const employee = client.getQueryData<Employee[]>(['employees'])?.find(e => e.id === employeeId || e.employee_id === employeeId);
      toast(`Đã lưu và đồng bộ vân tay ${session.data.finger_name} của ${employee?.full_name || employeeId} (${employee?.employee_id || employeeId}) trên thiết bị ${session.data.device_id}.`, 'success', "Lưu vân tay thành công");
      return true;
    } catch (e: any) { toast(e.message, 'error', "Không thể lưu vân tay"); throw e; }
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
    } catch (e: any) { toast(e.message, 'error', "Không thể hủy phiên vân tay"); }
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
