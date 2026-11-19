// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...args: any[]) => void>, on(name: string, fn: (...args: any[]) => void) { this.handlers[name] = fn; }, disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => socket }));
import * as api from '../../src/features/attendances/api/attendanceApi';
import { useAttendanceSocket } from '../../src/features/attendances/hooks/useAttendanceSocket';
import { LiveEventFeed } from '../../src/features/attendances/components/LiveEventFeed';

it('loads all of today without a socket connection, merges live scans, and keeps a scrollable fixed box', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T10:00:00+07:00'));
  const records = Array.from({ length: 18 }, (_, index) => ({ attendance_id: `log-${index}`, employee_id: `NV-${index}`, employee_name: `Nhân viên ${index}`, type: index % 2 ? 'CHECK_OUT' : 'CHECK_IN', timestamp: `2026-11-19T02:${String(index).padStart(2, '0')}:00Z` }));
  const fetch = vi.spyOn(api, 'fetchAttendanceApi').mockResolvedValue(records as any);
  let state: ReturnType<typeof useAttendanceSocket>;
  function Monitor() {
    state = useAttendanceSocket();
    return <LiveEventFeed events={state.liveEvents} />;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Monitor /></QueryClientProvider>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(fetch).toHaveBeenCalledWith({ date: '2026-11-19', fetchAllPages: true });
    expect(state!.liveEvents).toHaveLength(18);
    expect(host.textContent).toContain('Nhật ký chấm công hôm nay');
    expect(host.textContent).not.toContain('Socket.IO');
    expect(host.firstElementChild?.className).toContain('h-[500px]');
    expect(host.querySelector('[role="log"]')?.className).toContain('overflow-y-auto');
    const badges = [...host.querySelectorAll('span')];
    expect(badges.find(badge => badge.textContent === 'VÀO CA THÀNH CÔNG')?.className).toContain('text-emerald-700');
    expect(badges.find(badge => badge.textContent === 'TAN CA THÀNH CÔNG')?.className).toContain('text-amber-700');
    await act(async () => socket.handlers['checked-in']({ ...records[0] }));
    expect(state!.liveEvents).toHaveLength(18);
    await act(async () => socket.handlers['checked-out']({ ...records[1], attendance_id: 'new-log' }));
    expect(state!.liveEvents).toHaveLength(19);
    await act(async () => socket.handlers['checked-in']({ ...records[0], attendance_id: 'yesterday', timestamp: '2026-11-18T16:59:59Z' }));
    expect(state!.liveEvents).toHaveLength(19);
    await act(async () => root.render(<QueryClientProvider client={client}><LiveEventFeed events={[]} isLoading /></QueryClientProvider>));
    expect(host.firstElementChild?.className).toContain('h-[500px]');
  } finally { act(() => root.unmount()); client.clear(); fetch.mockRestore(); vi.useRealTimers(); }
});
