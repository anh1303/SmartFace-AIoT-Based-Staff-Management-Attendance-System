import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export interface Operation {
  jobId: string; type: string; label: string; status: 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed'; revision: number;
  progress: { total: number; completed: number; succeeded: number; failed: number; skipped: number };
  error?: string; items?: { item_key: string; status: string; error?: string }[]; result?: Record<string, unknown>;
}
const active = (job: Operation) => job.status === 'queued' || job.status === 'running';
const statusText = (job: Operation) => active(job) ? 'Đang thực hiện' : job.status === 'succeeded' ? 'Đã thành công' : 'Lỗi';
const counts = (job: Operation) => `${job.progress.completed}/${job.progress.total} · ${job.progress.succeeded} thành công · ${job.progress.failed} lỗi · ${job.progress.skipped} bỏ qua`;
const Context = createContext<{ jobs: Operation[] } | null>(null);
export const useOperations = () => { const context = useContext(Context); if (!context) throw new Error('OperationsProvider is required'); return context; };

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const client = useQueryClient();
  const userId = currentUser?.employee_id;
  const key = ['operations', userId];
  const shown = useRef(new Map<string, string>());
  const completed = useRef(new Map<string, number>());
  const latestToast = useRef(showToast); latestToast.current = showToast;
  const query = useQuery({ queryKey: key, enabled: Boolean(userId), queryFn: async ({ signal }) => {
    const response = await apiFetch<Operation[]>('/api/operations', { signal });
    return response.data || [];
  }, refetchInterval: (q) => (q.state.data?.some(active) ? 4000 : false), staleTime: 30000, retry: 1 });
  const jobs = userId ? query.data || [] : [];

  useEffect(() => {
    shown.current.clear(); completed.current.clear();
    if (!userId) return;
    const socket = io(`${import.meta.env.VITE_SOCKET_URL || window.location.origin}/operations`, { withCredentials: true });
    const refreshData = () => {
      for (const domain of ['employees', 'shifts', 'attendance', 'attendanceSummaries', 'dashboard']) void client.invalidateQueries({ queryKey: [domain] });
    };
    const refresh = () => { void client.invalidateQueries({ queryKey: ['operations', userId] }); refreshData(); };
    socket.on('connect', refresh); socket.on('operation.updated', refresh);
    socket.on('data.changed', (event: { domain: string; message: string }) => {
      void client.invalidateQueries({ queryKey: [event.domain] });
      if (event.domain === 'biometrics') void client.invalidateQueries({ queryKey: ['employees'] });
      for (const domain of ['attendanceSummaries', 'dashboard']) void client.invalidateQueries({ queryKey: [domain] });
      latestToast.current(event.message, 'info', 'Dữ liệu vừa được cập nhật');
    });
    const fallback = window.setInterval(() => {
      if (!socket.connected && document.visibilityState === 'visible') refreshData();
    }, 5000);
    return () => { window.clearInterval(fallback); socket.disconnect(); client.removeQueries({ queryKey: ['operations', userId] }); };
  }, [client, userId]);

  useEffect(() => {
    for (const job of jobs) {
      const priorCount = completed.current.get(job.jobId) || 0;
      completed.current.set(job.jobId, job.progress.completed);
      if (job.type === 'shifts.batch' && job.progress.completed > priorCount) {
        for (const domain of ['shifts', 'attendance', 'attendanceSummaries', 'dashboard']) void client.invalidateQueries({ queryKey: [domain] });
      }
      const previous = shown.current.get(job.jobId);
      if (previous === job.status) continue;
      shown.current.set(job.jobId, job.status);
      if (!active(job) && previous !== undefined) {
        const action = job.type === 'shifts.batch' ? 'Phân công ca làm việc' : job.type === 'biometric.enroll' ? 'Lưu Face ID' : job.type === 'employee.email' ? 'Gửi email tài khoản' : 'Lưu dữ liệu';
        latestToast.current(`${job.label}: ${statusText(job)}. ${counts(job)}${job.error ? `. ${job.error}` : ''}`, job.status === 'failed' ? 'error' : job.status === 'partially_succeeded' ? 'warning' : 'success', job.status === 'succeeded' ? `${action} thành công` : job.status === 'partially_succeeded' ? `${action} chưa hoàn tất` : `Không thể ${action.charAt(0).toLocaleLowerCase('vi-VN')}${action.slice(1)}`);
        for (const domain of ['employees', 'shifts', 'attendance', 'attendanceSummaries', 'dashboard', 'biometrics']) void client.invalidateQueries({ queryKey: [domain] });
      }
    }
  }, [jobs, client]);

  return <Context.Provider value={{ jobs }}>{children}</Context.Provider>;
}
