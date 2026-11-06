// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ handlers: new Map<string, Function>(), toast: vi.fn(), count: 0 }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: (name: string, handler: Function) => { state.handlers.set(name, handler); }, disconnect: vi.fn() }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { employee_id: 'NV1' } }) }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock('../../src/features/attendances/api/attendanceApi', () => ({ fetchAttendanceApi: async () => [], addAttendanceApi: vi.fn() }));
import { useAttendance } from '../../src/features/attendances/hooks/useAttendance';
import { addAttendanceApi } from '../../src/features/attendances/api/attendanceApi';
let attendance: ReturnType<typeof useAttendance>;
function AppPage() {
  attendance = useAttendance();
  const overview = useQuery({ queryKey: ['dashboard', 'today'], queryFn: async () => state.count, staleTime: Infinity });
  return <p>Đã chấm công: {overview.data ?? 0}</p>;
}
it('refreshes dashboard totals when attendance changes without remounting or a browser refresh', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); const client = new QueryClient();
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><AppPage /></QueryClientProvider>));
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(host.textContent).toContain('Đã chấm công: 0');
    state.count = 1;
    await act(async () => {
      state.handlers.get('checked-in')!({ employee_id: 'NV1' });
      await vi.waitFor(() => expect(client.getQueryData(['dashboard', 'today'])).toBe(1));
    });
    await vi.waitFor(async () => {
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      expect(host.textContent).toContain('Đã chấm công: 1');
    });
    expect(host.textContent).toContain('Đã chấm công: 1');
  } finally { act(() => root.unmount()); client.clear(); host.remove(); }
});
it('reports an ignored repeat scan instead of claiming a new attendance event was recorded', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); const client = new QueryClient();
  vi.mocked(addAttendanceApi).mockResolvedValue({ ignored: true, message: 'Bỏ qua lượt quét lặp; chờ 540s.' } as any);
  state.toast.mockClear();
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><AppPage /></QueryClientProvider>));
    await act(async () => { attendance.addAttendanceRecord({ employee_id: 'NV1' } as any); await new Promise(r => setTimeout(r, 20)); });
    expect(state.toast).toHaveBeenCalledWith('Bỏ qua lượt quét lặp; chờ 540s.', 'info');
    expect(state.toast.mock.calls.some(call => call[1] === 'success')).toBe(false);
  } finally { act(() => root.unmount()); client.clear(); host.remove(); }
});
