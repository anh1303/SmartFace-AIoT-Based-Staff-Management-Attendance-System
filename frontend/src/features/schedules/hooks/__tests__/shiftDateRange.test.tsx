// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../../../api/client', () => ({
  apiFetch: apiMocks.apiFetch,
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    currentUser: { employee_id: 'ADMIN-1', full_name: 'Admin', role: 'ADMIN' },
    isInitializing: false,
    role: 'admin',
  }),
}));

import { fetchShiftsApi } from '../../api/shiftApi';
import { useShifts } from '../useShifts';
import { ShiftProvider, useShiftContext } from '../../context/ShiftContext';

async function waitForAssertion(fn: () => void, timeoutMs = 2000) {
  const start = Date.now();
  while (true) {
    try {
      fn();
      return;
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });
    }
  }
}

describe('Task 5 & Task 4 - Frontend shifts date-range wiring & multi-month history consumer isolation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('fetchShiftsApi encodes startDate/endDate query params', async () => {
    apiMocks.apiFetch.mockResolvedValueOnce({ success: true, data: [] });
    await fetchShiftsApi({ startDate: '2026-11-23', endDate: '2026-11-29' });
    expect(apiMocks.apiFetch).toHaveBeenCalledWith(
      '/api/shifts?startDate=2026-11-23&endDate=2026-11-29',
    );
  });

  it('isolates weekly schedule cache from multi-month history consumer (ShiftProvider) and invalidates both on mutation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    apiMocks.apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') {
        return {
          success: true,
          data: {
            shift_id: 'w1',
            employee_id: 'EMP-1',
            date: '2026-11-24',
            shift_type: 'AFTERNOON',
          },
        };
      }
      if (url === '/api/shifts') {
        return {
          success: true,
          data: [
            { shift_id: 'hist-oct', employee_id: 'EMP-1', date: '2026-10-05', shift_type: 'OFFICE_HOURS' },
            { shift_id: 'w1', employee_id: 'EMP-1', date: '2026-11-24', shift_type: 'OFFICE_HOURS' },
            { shift_id: 'w2', employee_id: 'EMP-1', date: '2026-12-01', shift_type: 'MORNING' },
          ],
        };
      }
      if (url.includes('2026-11-23')) {
        return {
          success: true,
          data: [{ shift_id: 'w1', employee_id: 'EMP-1', date: '2026-11-24', shift_type: 'OFFICE_HOURS' }],
        };
      }
      return {
        success: true,
        data: [{ shift_id: 'w2', employee_id: 'EMP-1', date: '2026-12-01', shift_type: 'MORNING' }],
      };
    });

    let latestHook: ReturnType<typeof useShifts> | null = null;
    function ScheduleWeekView({ startDate, endDate }: { startDate: string; endDate: string }) {
      latestHook = useShifts(true, { startDate, endDate });
      return <span data-testid="week">{latestHook.workShifts.map((s) => s.shift_id).join(',')}</span>;
    }

    function HistoryConsumerView() {
      const { workShifts } = useShiftContext();
      return <span data-testid="history">{workShifts.map((s) => s.shift_id).join(',')}</span>;
    }

    // 1. Schedule week view alone -> fetches ONLY bounded week range (ShiftProvider stays idle!)
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ShiftProvider>
            <ScheduleWeekView startDate="2026-11-23" endDate="2026-11-29" />
          </ShiftProvider>
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => expect(container.textContent).toBe('w1'));
    expect(apiMocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(apiMocks.apiFetch).toHaveBeenLastCalledWith('/api/shifts?startDate=2026-11-23&endDate=2026-11-29');
    expect(queryClient.getQueryData(['shifts', { startDate: '2026-11-23', endDate: '2026-11-29' }])).toHaveLength(1);

    // 2. Switch to next week -> fetches new week range
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ShiftProvider>
            <ScheduleWeekView startDate="2026-11-30" endDate="2026-12-06" />
          </ShiftProvider>
        </QueryClientProvider>,
      );
    });
    await waitForAssertion(() => expect(container.textContent).toBe('w2'));
    expect(apiMocks.apiFetch).toHaveBeenCalledTimes(2);

    // 3. Switch back to week 1 -> cache hit, 0 extra requests
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ShiftProvider>
            <ScheduleWeekView startDate="2026-11-23" endDate="2026-11-29" />
          </ShiftProvider>
        </QueryClientProvider>,
      );
    });
    await waitForAssertion(() => expect(container.textContent).toBe('w1'));
    expect(apiMocks.apiFetch).toHaveBeenCalledTimes(2);

    // 4. Mount Employee Detail / History consumer -> fetches full history under ['shifts'] without clobbering week cache
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ShiftProvider>
            <ScheduleWeekView startDate="2026-11-23" endDate="2026-11-29" />
            <HistoryConsumerView />
          </ShiftProvider>
        </QueryClientProvider>,
      );
    });
    await waitForAssertion(() => expect(container.textContent).toBe('w1hist-oct,w1,w2'));
    expect(apiMocks.apiFetch).toHaveBeenCalledTimes(3);
    expect(apiMocks.apiFetch).toHaveBeenLastCalledWith('/api/shifts');

    // 5. Mutate a shift -> invalidates ['shifts'] prefix so BOTH active week and active history refetch
    await act(async () => {
      await latestHook!.assignOrUpdateShift({
        employee_id: 'EMP-1',
        date: '2026-11-24',
        work_day: 'Thứ Ba',
        shift_type: 'AFTERNOON',
        start_time: '13:00',
        end_time: '17:00',
        department: 'Engineering',
        note: '',
      });
    });

    await waitForAssertion(() => {
      const getCalls = apiMocks.apiFetch.mock.calls.filter(([, opts]) => !opts?.method);
      expect(getCalls).toHaveLength(5);
    });
  });
});
