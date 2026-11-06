import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
const statusText = (job: Operation) => job.status === 'queued' ? 'Đang chờ' : job.status === 'running' ? 'Đang xử lý' : job.status === 'failed' ? 'Thất bại' : job.status === 'partially_succeeded' ? 'Hoàn tất một phần' : 'Hoàn tất';
const counts = (job: Operation) => `${job.progress.completed}/${job.progress.total} · ${job.progress.succeeded} thành công · ${job.progress.failed} lỗi · ${job.progress.skipped} bỏ qua`;
const Context = createContext<{ jobs: Operation[]; track: (job: Operation) => void } | null>(null);
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
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Operation | null>(null);
  const [detailError, setDetailError] = useState('');
  const query = useQuery({ queryKey: key, enabled: Boolean(userId), queryFn: async ({ signal }) => {
    const response = await apiFetch<Operation[]>('/api/operations', { signal });
    return response.data || [];
  }, refetchInterval: 3000, staleTime: 0, retry: 1 });
  const jobs = userId ? query.data || [] : [];
  const writes = useMutationState({ filters: { mutationKey: ['employee-write'], status: 'pending' }, select: mutation => ({ id: mutation.mutationId, variables: mutation.state.variables as any, kind: mutation.options.mutationKey?.[1] }) });
  const track = useCallback((job: Operation) => {
    if (!userId || latestUser.current !== userId) return;
    client.setQueryData<Operation[]>(['operations', userId], prev => [job, ...(prev || []).filter(j => j.jobId !== job.jobId)]);
    latestToast.current(`${job.label}: đã tiếp nhận, đang xử lý nền. Bạn có thể chuyển trang.`, 'info');
    void client.invalidateQueries({ queryKey: ['operations', userId] });
  }, [client, userId]);

  useEffect(() => {
    shown.current.clear(); completed.current.clear(); setDetail(null); setExpanded(false);
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

  async function openDetails(job: Operation) {
    setDetail(job); setDetailError('');
    try { const response = await apiFetch<Operation>(`/api/operations/${job.jobId}`); if (latestUser.current === userId) setDetail(response.data!); }
    catch (error) { if (latestUser.current === userId) setDetailError(error instanceof Error ? error.message : 'Không tải được chi tiết.'); }
  }
  async function retryFailed(job: Operation) {
    latestToast.current('Đang gửi lại các ca chưa lưu. Ca đã thành công sẽ được giữ nguyên.', 'info');
    try { track(await submitBackgroundCommand(`/api/operations/${job.jobId}/retry`, {})); setDetail(null); }
    catch (error) { latestToast.current(error instanceof Error ? error.message : 'Chưa gửi lại được tác vụ.', 'error'); }
  }
  const running = jobs.filter(active).length;
  return <Context.Provider value={{ jobs, track }}>{children}{userId && (jobs.length > 0 || writes.length > 0 || query.isError) &&
    <aside aria-label="Trạng thái lưu và tác vụ nền" className="fixed bottom-4 left-4 z-40 max-h-[65vh] w-[min(25rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
      <button type="button" className="flex w-full justify-between gap-3 font-semibold" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>Hoạt động {running + writes.length ? `· ${running + writes.length} đang xử lý` : '· Đã cập nhật'}<span>{expanded ? 'Thu gọn' : 'Xem'}</span></button>
      <div role="status" aria-live="polite">{writes.map(write => <p key={write.id}>Đang lưu {write.variables?.full_name || write.variables?.id || 'nhân viên'}…</p>)}{running > 0 && <p>Bạn có thể chuyển trang; tác vụ vẫn tiếp tục.</p>}</div>
      {query.isError && <p role="alert">Chưa kết nối được để theo dõi tiến độ. Chưa xác định kết quả tác vụ; hệ thống sẽ thử kết nối lại.</p>}
      {(expanded ? jobs : jobs.slice(0, 2)).map(job => (
        <div key={job.jobId} className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
          <strong>{job.label}</strong>
          <p role="status" aria-live="polite">{statusText(job)} · {counts(job)}</p>
          {job.error && <p className="text-rose-700 dark:text-rose-300">{job.error}</p>}
          <button type="button" className="underline" onClick={() => void openDetails(job)}>Xem kết quả từng mục</button>
        </div>
      ))}
      {detail && (
        <section className="mt-3 border-t pt-2" aria-label="Chi tiết tác vụ">
          <button type="button" className="float-right underline" onClick={() => setDetail(null)}>Đóng chi tiết</button>
          <strong>{detail.label}</strong>
          {detailError && <p role="alert">{detailError}</p>}
          <p>{statusText(detail)} · {counts(detail)}</p>
          {detail.items?.map(item => (
            <p key={item.item_key}>
              {item.item_key}: {item.status === 'succeeded' ? 'Đã lưu' : item.status === 'failed' ? 'Chưa lưu được' : item.status === 'skipped' ? 'Bỏ qua ngày quá khứ' : 'Đang chờ'}
              {item.error ? ` — ${item.error}` : ''}
            </p>
          ))}
          {detail.error && <p role="alert">{detail.error}</p>}
          {detail.type === 'shifts.batch' && ['failed', 'partially_succeeded'].includes(detail.status) && <>
            <p>Thử lại chỉ xử lý ca lỗi. Nếu ca đã bị sửa ở nơi khác, cần tải lại lịch và xác nhận thay đổi tại trang Lịch làm việc.</p>
            <button type="button" className="mt-2 underline" onClick={() => void retryFailed(detail)}>Thử lại các ca lỗi</button>
          </>}
          {detail.status === 'failed' && detail.type === 'biometric.enroll' && <p>Vui lòng quay lại Sinh trắc học và tải lại ảnh để thử lại.</p>}
          {detail.type === 'biometric.enroll' && detail.status === 'succeeded' && detail.result && <p>Đã lưu {String(detail.result.n_samples_used ?? '')} mẫu khuôn mặt hợp lệ.</p>}
        </section>
      )}
    </aside>}</Context.Provider>;
}
