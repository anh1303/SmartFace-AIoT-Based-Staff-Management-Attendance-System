// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const toast = vi.hoisted(() => vi.fn());
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'user1', employee_id: 'NV1' } }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
import { OperationsProvider, useOperations } from '../../src/features/operations/OperationsProvider';
import { apiFetch } from '../../src/api/client';
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn() }));
it('keeps background recovery and cache updates across navigation without rendering a progress panel', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  let operations: ReturnType<typeof useOperations>;
  function Page({ name }: { name: string }) { operations = useOperations(); return <main>{name}</main>; }
  const job = { jobId: 'job1', label: 'Sao chép lịch tuần trước', type: 'shifts.batch', revision: 1, status: 'running', progress: { total: 7, completed: 2, succeeded: 2, failed: 0, skipped: 0 } };
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: [job] } as any);
  await act(async () => root.render(<QueryClientProvider client={client}><OperationsProvider><Page name="Lịch"/></OperationsProvider></QueryClientProvider>));
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  expect(operations!.jobs[0].jobId).toBe('job1');
  expect(host.textContent).toBe('Lịch');
  expect(host.querySelector('[aria-label="Tiến trình tác vụ"]')).toBeNull();
  await act(async () => root.render(<QueryClientProvider client={client}><OperationsProvider><Page name="Nhân viên"/></OperationsProvider></QueryClientProvider>));
  expect(operations!.jobs[0].progress.completed).toBe(2);
  await act(async () => { client.setQueryData(['operations', 'NV1'], [{ ...job, revision: 2, status: 'partially_succeeded', progress: { total: 7, completed: 7, succeeded: 6, failed: 1, skipped: 0 } }]); await new Promise(r => setTimeout(r, 20)); });
  expect(host.textContent).not.toContain('Xem kết quả từng mục'); expect(host.querySelector('aside')).toBeNull();
  expect(host.textContent).toBe('Nhân viên');
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('1 lỗi'), 'warning', 'Phân công ca làm việc chưa hoàn tất');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['shifts'] });
  await act(async () => { client.setQueryData(['operations', 'NV1'], [{ ...job, revision: 3, status: 'succeeded', progress: { total: 7, completed: 7, succeeded: 7, failed: 0, skipped: 0 } }]); await new Promise(r => setTimeout(r, 20)); });
  expect(operations!.jobs[0].status).toBe('succeeded');
  expect(host.textContent).toBe('Nhân viên');
  expect(host.textContent).not.toContain('0 bỏ qua');
  act(() => root.unmount()); client.clear(); host.remove();
});
