// @vitest-environment jsdom
import React, { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type Handler = (...args: any[]) => void;

const mocks = vi.hoisted(() => {
  let activeConnections = 0;
  let disconnectCalls = 0;
  const listeners = new Map<string, Set<Handler>>();

  const createFakeSocket = () => {
    activeConnections += 1;
    let closed = false;
    const ownHandlers: Array<[string, Handler]> = [];
    return {
      on: vi.fn((event: string, fn: Handler) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
        ownHandlers.push([event, fn]);
      }),
      off: vi.fn((event: string, fn: Handler) => {
        listeners.get(event)?.delete(fn);
      }),
      disconnect: vi.fn(() => {
        if (!closed) {
          closed = true;
          activeConnections -= 1;
          disconnectCalls += 1;
          for (const [ev, fn] of ownHandlers) {
            listeners.get(ev)?.delete(fn);
          }
        }
      }),
    };
  };

  return {
    getActiveConnections: () => activeConnections,
    getDisconnectCalls: () => disconnectCalls,
    emitServer(event: string, payload?: unknown) {
      for (const fn of listeners.get(event) || []) {
        fn(payload);
      }
    },
    resetSocketState() {
      activeConnections = 0;
      disconnectCalls = 0;
      listeners.clear();
    },
    io: vi.fn((..._args: unknown[]) => createFakeSocket()),
    fetchPayrollApi: vi.fn(),
    fetchBonusPenaltyApi: vi.fn(),
    fetchShiftsApi: vi.fn(),
    fetchAttendanceApi: vi.fn(),
    showToast: vi.fn(),
  };
});

vi.mock('socket.io-client', () => ({
  io: mocks.io,
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    currentUser: { employee_id: 'ADMIN-1', full_name: 'Admin', role: 'ADMIN' },
    isInitializing: false,
    role: 'admin',
  }),
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../payrolls/api/payrollApi', () => ({
  fetchPayrollApi: mocks.fetchPayrollApi,
  fetchBonusPenaltyApi: mocks.fetchBonusPenaltyApi,
  generatePayrollApi: vi.fn(),
  updatePayrollItemApi: vi.fn(),
  finalizePayrollPeriodApi: vi.fn(),
  unlockPayrollPeriodApi: vi.fn(),
  updateBonusPenaltyApi: vi.fn(),
}));

vi.mock('../../../schedules/api/shiftApi', () => ({
  fetchShiftsApi: mocks.fetchShiftsApi,
  assignShiftApi: vi.fn(),
}));

vi.mock('../../api/attendanceApi', () => ({
  fetchAttendanceApi: mocks.fetchAttendanceApi,
  addAttendanceApi: vi.fn(),
}));

import { PayrollProvider, usePayrollContext } from '../../../payrolls/context/PayrollContext';
import { ShiftProvider } from '../../../schedules/context/ShiftContext';
import { AttendanceProvider } from '../../context/AttendanceContext';
import { useAttendanceSocket } from '../useAttendanceSocket';

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Task 7 & Task 4 - Demand-driven providers, StrictMode lifecycle, fake-timer 150ms burst, reconnect & toast rules', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.resetSocketState();
    mocks.fetchPayrollApi.mockResolvedValue([]);
    mocks.fetchBonusPenaltyApi.mockResolvedValue(null);
    mocks.fetchShiftsApi.mockResolvedValue([]);
    mocks.fetchAttendanceApi.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it('keeps at most 1 live /attendance connection under StrictMode, cleans up to 0 on unmount, and only fetches retained domains', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function ReportsPeriodOnly() {
      const { selectedPeriod } = usePayrollContext({ loadData: false });
      return <div data-testid="period">{selectedPeriod}</div>;
    }

    function PayrollConsumer() {
      const { payroll } = usePayrollContext();
      return <div data-testid="payroll-len">{payroll.length}</div>;
    }

    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <PayrollProvider>
              <ShiftProvider>
                <AttendanceProvider>
                  <ReportsPeriodOnly />
                </AttendanceProvider>
              </ShiftProvider>
            </PayrollProvider>
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    await flushMicrotasks();

    // StrictMode mounted -> cleaned up -> remounted: exactly 1 live connection remains
    expect(mocks.getActiveConnections()).toBe(1);
    expect(mocks.getDisconnectCalls()).toBeGreaterThanOrEqual(1);
    expect(mocks.fetchPayrollApi).toHaveBeenCalledTimes(0);
    expect(mocks.fetchBonusPenaltyApi).toHaveBeenCalledTimes(0);
    expect(mocks.fetchShiftsApi).toHaveBeenCalledTimes(0);
    expect(mocks.fetchAttendanceApi).toHaveBeenCalledTimes(0);

    // Route change: mount PayrollConsumer -> fetches payroll once while keeping 1 live socket
    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <PayrollProvider>
              <ShiftProvider>
                <AttendanceProvider>
                  <PayrollConsumer />
                </AttendanceProvider>
              </ShiftProvider>
            </PayrollProvider>
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    await flushMicrotasks();

    expect(mocks.getActiveConnections()).toBe(1);
    expect(mocks.fetchPayrollApi).toHaveBeenCalledTimes(1);
    expect(mocks.fetchBonusPenaltyApi).toHaveBeenCalledTimes(1);

    // Unmount entire app -> releases all live socket connections to 0
    await act(async () => {
      root.unmount();
    });
    expect(mocks.getActiveConnections()).toBe(0);
    // Re-create root for afterEach cleanup
    root = createRoot(container);
  });

  it('debounces 150ms burst with fake timers, deduplicates repeated IDs (1 toast), refreshes on reconnect, and reuses vs fetches today-log based on date range', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const monitorToast = vi.fn();

    function MonitorHarness({ includesToday }: { includesToday: boolean }) {
      const attendanceQuery = useQuery({
        queryKey: ['attendance', { monitor: true, includesToday }],
        queryFn: () => mocks.fetchAttendanceApi({ range: includesToday ? 'includes-today' : 'past-week' }),
      });
      const { liveEvents } = useAttendanceSocket({
        showToast: monitorToast,
        externalTodayLogs: includesToday ? attendanceQuery : undefined,
      });
      return <div data-testid="live-count">{liveEvents.length}</div>;
    }

    // Mount Monitor viewing range that INCLUDES today -> reuses attendanceQuery (no extra today-log fetch)
    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <PayrollProvider>
              <AttendanceProvider>
                <MonitorHarness includesToday={true} />
              </AttendanceProvider>
            </PayrollProvider>
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    await flushMicrotasks();

    expect(mocks.getActiveConnections()).toBe(1);
    expect(mocks.fetchAttendanceApi).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPayrollApi).toHaveBeenCalledTimes(0);

    // Simulate initial connect + two distinct check-in events + one duplicate event ID inside 150ms window
    const nowIso = new Date().toISOString();
    await act(async () => {
      mocks.emitServer('connect');
      mocks.emitServer('checked-in', {
        id: 'evt-1',
        employee_code: 'EMP-001',
        employee_name: 'Alice',
        timestamp: nowIso,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(40);
      // Duplicate ID -> must be ignored (no second toast for evt-1)
      mocks.emitServer('checked-in', {
        id: 'evt-1',
        employee_code: 'EMP-001',
        employee_name: 'Alice',
        timestamp: nowIso,
      });
      // Distinct second check-in
      mocks.emitServer('checked-in', {
        id: 'evt-2',
        employee_code: 'EMP-002',
        employee_name: 'Bob',
        timestamp: nowIso,
      });
    });

    // At t = 140ms (< 150ms window): still 0 refetches!
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(mocks.fetchAttendanceApi).toHaveBeenCalledTimes(1);

    // Cross 150ms boundary -> exactly 1 debounced attendance refetch, 0 payroll requests
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await flushMicrotasks();

    expect(container.textContent).toBe('2');
    // 2 distinct check-ins -> 2 detailed toasts, duplicate evt-1 ignored, generic toast suppressed
    expect(monitorToast).toHaveBeenCalledTimes(2);
    expect(mocks.showToast).toHaveBeenCalledTimes(0);
    expect(mocks.fetchAttendanceApi).toHaveBeenCalledTimes(2);
    expect(mocks.fetchPayrollApi).toHaveBeenCalledTimes(0);

    // Simulate socket disconnect + reconnect -> triggers immediate active query resync
    await act(async () => {
      mocks.emitServer('disconnect');
      mocks.emitServer('connect');
    });
    await flushMicrotasks();
    expect(mocks.fetchAttendanceApi).toHaveBeenCalledTimes(3);
    expect(mocks.fetchPayrollApi).toHaveBeenCalledTimes(0);

    // Switch Monitor filter to a past range that DOES NOT include today -> today-log query activates for LiveFeed
    await act(async () => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <PayrollProvider>
              <AttendanceProvider>
                <MonitorHarness includesToday={false} />
              </AttendanceProvider>
            </PayrollProvider>
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    await flushMicrotasks();

    const todayLogCall = mocks.fetchAttendanceApi.mock.calls.find(
      ([arg]) => arg && typeof arg === 'object' && 'date' in arg && arg.fetchAllPages === true,
    );
    expect(todayLogCall).toBeDefined();
  });
});
