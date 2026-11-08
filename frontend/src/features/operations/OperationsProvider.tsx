import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { submitBackgroundCommand } from './commandApi';

export interface Operation {
  jobId: string; type: string; label: string; status: 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed'; revision: number;
  progress: { total: number; completed: number; succeeded: number; failed: number; skipped: number };
  error?: string; items?: { item_key: string; status: string; error?: string }[]; result?: Record<string, unknown>;
}
const active = (job: Operation) => job.status === 'queued' || job.status === 'running';
const statusText = (job: Operation) => active(job) ? 'Đang thực hiện' : job.status === 'succeeded' ? 'Đã thành công' : 'Lỗi';
const counts = (job: Operation) => `${job.progress.completed}/${job.progress.total} · ${job.progress.succeeded} thành công · ${job.progress.failed} lỗi · ${job.progress.skipped} bỏ qua`;
const Context = createContext<{ jobs: Operation[]; track: (job: Operation) => void; panel: React.ReactNode } | null>(null);
export const useOperations = () => { const context = useContext(Context); if (!context) throw new Error('OperationsProvider is required'); return context; };

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const client = useQueryClient();
  const userId = currentUser?.employee_id;
  const latestUser = useRef(userId); latestUser.current = userId;
  const key = ['operations', userId];
  const shown = useRef(new Map<string, string>());
  const completed = useRef(new Map<string, number>());
  const latestToast = useRef(showToast); latestToast.current = showToast;
  const query = useQuery({ queryKey: key, enabled: Boolean(userId), queryFn: async ({ signal }) => {
    const response = await apiFetch<Operation[]>('/api/operations', { signal });
    return response.data || [];
  }, refetchInterval: (q) => (q.state.data?.some(active) ? 4000 : false), staleTime: 30000, retry: 1 });
  const jobs = userId ? query.data || [] : [];
  const writes = useMutationState({ filters: { mutationKey: ['employee-write'], status: 'pending' }, select: mutation => ({ id: mutation.mutationId, variables: mutation.state.variables as any, kind: mutation.options.mutationKey?.[1] }) });
  const track = useCallback((job: Operation) => {
    if (!userId || latestUser.current !== userId) return;
    client.setQueryData<Operation[]>(['operations', userId], prev => [job, ...(prev || []).filter(j => j.jobId !== job.jobId)]);
    latestToast.current(`${job.label}: đã tiếp nhận, đang xử lý nền. Bạn có thể chuyển trang.`, 'info');
    void client.invalidateQueries({ queryKey: ['operations', userId] });
  }, [client, userId]);

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
      latestToast.current(event.message, 'info');
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
        latestToast.current(`${job.label}: ${statusText(job)}. ${counts(job)}${job.error ? `. ${job.error}` : ''}`, job.status === 'failed' ? 'error' : job.status === 'partially_succeeded' ? 'warning' : 'success');
        for (const domain of ['employees', 'shifts', 'attendance', 'attendanceSummaries', 'dashboard', 'biometrics']) void client.invalidateQueries({ queryKey: [domain] });
      }
    }
  }, [jobs, client]);

  async function retryFailed(job: Operation) {
    latestToast.current('Đang gửi lại các ca chưa lưu. Ca đã thành công sẽ được giữ nguyên.', 'info');
    try { track(await submitBackgroundCommand(`/api/operations/${job.jobId}/retry`, {})); }
    catch (error) { latestToast.current(error instanceof Error ? error.message : 'Chưa gửi lại được tác vụ.', 'error'); }
  }
  const running = jobs.filter(active).length;
  const panel = userId && (jobs.length > 0 || writes.length > 0 || query.isError) ? (
    <section aria-label="Tiến trình tác vụ" className="border-b border-slate-200 p-4 text-sm dark:border-slate-700">
      <h3 className="font-semibold">Tiến trình</h3>
      <div role="status" aria-live="polite">{writes.map(write => <p key={write.id}>Đang lưu {write.variables?.full_name || write.variables?.id || 'nhân viên'}…</p>)}{running > 0 && <p>Bạn có thể chuyển trang; tác vụ vẫn tiếp tục.</p>}</div>
      {query.isError && <p role="alert">Chưa kết nối được để theo dõi tiến độ. Chưa xác định kết quả tác vụ; hệ thống sẽ thử kết nối lại.</p>}
      {jobs.map(job => (
        <div key={job.jobId} className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
          <strong>{job.label}</strong>
          <p role="status" aria-live="polite" className={active(job) ? 'font-medium text-blue-700 dark:text-blue-300' : job.status === 'succeeded' ? 'font-medium text-green-700 dark:text-green-300' : 'font-medium text-red-700 dark:text-red-300'}>{statusText(job)}{active(job) && ` · ${job.progress.completed}/${job.progress.total}`}</p>
          {job.status === 'partially_succeeded' && <p>{job.progress.succeeded} thành công · {job.progress.failed} lỗi</p>}
          {job.error && <p className="text-rose-700 dark:text-rose-300">{job.error}</p>}
          {job.type === 'shifts.batch' && ['failed', 'partially_succeeded'].includes(job.status) && <button type="button" className="underline" onClick={() => void retryFailed(job)}>Thử lại các ca lỗi</button>}
        </div>
      ))}
    </section>
  ) : null;
  return <Context.Provider value={{ jobs, track, panel }}>{children}</Context.Provider>;
}

export function OperationsPanel() {
  return useOperations().panel;
}
