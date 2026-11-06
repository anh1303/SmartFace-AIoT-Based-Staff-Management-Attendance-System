// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const toast = vi.hoisted(() => vi.fn());
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'user1', employee_id: 'NV1' } }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
import { OperationsProvider } from '../../src/features/operations/OperationsProvider';
import { apiFetch } from '../../src/api/client';
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn() }));
it('keeps a visible progress panel while navigating and announces a partial failure', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const job = { jobId: 'job1', label: 'Sao chép lịch tuần trước', type: 'shifts.batch', revision: 1, status: 'running', progress: { total: 7, completed: 2, succeeded: 2, failed: 0, skipped: 0 } };
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: [job] } as any);
  await act(async () => root.render(<QueryClientProvider client={client}><OperationsProvider><main>Lịch</main></OperationsProvider></QueryClientProvider>));
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  expect(host.textContent).toContain('2/7'); expect(host.textContent).toContain('Đang xử lý');
  await act(async () => root.render(<QueryClientProvider client={client}><OperationsProvider><main>Nhân viên</main></OperationsProvider></QueryClientProvider>));
  expect(host.textContent).toContain('2/7');
  await act(async () => { client.setQueryData(['operations', 'NV1'], [{ ...job, revision: 2, status: 'partially_succeeded', progress: { total: 7, completed: 7, succeeded: 6, failed: 1, skipped: 0 } }]); await new Promise(r => setTimeout(r, 20)); });
  expect(host.textContent).toContain('1 lỗi'); expect(toast).toHaveBeenCalledWith(expect.stringContaining('1 lỗi'), 'warning');
  act(() => root.unmount()); client.clear(); host.remove();
});
