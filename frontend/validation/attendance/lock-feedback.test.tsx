// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ request: vi.fn(), toast: vi.fn() }));
vi.mock('../../src/api/client', () => ({ apiFetch: state.request }));
vi.mock('../../src/features/auth/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: state.toast }) }));
import { AttendanceHeader } from '../../src/features/attendances/components/AttendanceHeader';
import { useAttendanceLocks } from '../../src/features/attendances/hooks/useAttendanceLocks';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it.each([true, false])('keeps the pending action label when the refreshed lock state changes (lock=%s)', async lock => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const render = (locked: boolean) => root.render(<AttendanceHeader startDate="2026-11-16" endDate="2026-11-16" isCurrentDateLocked={locked} onToggleLock={() => pending} onExportCSV={() => {}}/>);
  try {
    await act(async () => render(!lock));
    await act(async () => host.querySelector('button')!.click());
    await act(async () => render(lock));
    expect(host.querySelector('button')!.textContent).toContain(lock ? 'Đang chốt công…' : 'Đang mở khóa…');
    await act(async () => finish());
    expect(host.querySelector('button')!.textContent).toContain(lock ? 'Mở khóa ngày' : 'Chốt ca');
  } finally { act(() => root.unmount()); host.remove(); }
});

it.each([true, false])('uses the submitted action for the endpoint and success message (lock=%s)', async lock => {
  state.toast.mockReset(); state.request.mockReset();
  state.request.mockImplementation(async (_url, options) => ({ success: true, data: options ? {} : [] }));
  let model!: ReturnType<typeof useAttendanceLocks>;
  function Probe() { model = useAttendanceLocks(); return null; }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));
    await act(async () => { await model.toggleLockAsync('2026-11-16', lock); });
    expect(state.request).toHaveBeenCalledWith(`/api/attendance/locks/${lock ? 'lock' : 'unlock'}`, { method: 'POST', body: JSON.stringify({ date: '2026-11-16' }) });
    expect(state.toast).toHaveBeenCalledWith(expect.any(String), 'success', lock ? 'Chốt ngày công thành công' : 'Mở khóa ngày công thành công');
  } finally { act(() => root.unmount()); client.clear(); host.remove(); }
});
