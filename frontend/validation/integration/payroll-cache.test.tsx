// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ fetch: vi.fn(), generate: vi.fn() }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/features/payrolls/api/payrollApi', () => ({ fetchPayrollApi: api.fetch, generatePayrollApi: api.generate, fetchBonusPenaltyApi: async () => null }));
import { usePayroll } from '../../src/features/payrolls/hooks/usePayroll';

it('loads the selected period and merges generation without refetching or dropping locked rows', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const pending = { payroll_id: 'pending', employee_id: 'E1', period: '2026-11', status: 'PENDING', net_salary: 1 };
  const paid = { payroll_id: 'paid', employee_id: 'E2', period: '2026-11', status: 'PAID', net_salary: 2 };
  api.fetch.mockImplementation(async (period: string) => period === '2026-11' ? [pending, paid] : []);
  api.generate.mockResolvedValue([{ ...pending, net_salary: 100 }]);
  let handle: ReturnType<typeof usePayroll>;
  function Probe() { handle = usePayroll(); return null; }
  const root = createRoot(document.createElement('div'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await act(async () => handle.setSelectedPeriod('2026-11'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(api.fetch).toHaveBeenCalledWith('2026-11');
    const before = api.fetch.mock.calls.length;
    await act(async () => { await handle.generatePayroll('2026-11'); });
    expect(handle!.payroll.map(row => [row.payroll_id, row.net_salary])).toEqual([['pending', 100], ['paid', 2]]);
    expect(api.fetch).toHaveBeenCalledTimes(before);
    await act(async () => handle.setSelectedPeriod('2026-10'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(api.fetch).toHaveBeenLastCalledWith('2026-10');
    expect(handle!.payroll).toEqual([]);
    await act(async () => handle.setSelectedPeriod('2026-11'));
    expect(handle!.payroll[0].net_salary).toBe(100);
  } finally { act(() => root.unmount()); client.clear(); }
});

it('ignores a stale read started while payroll generation is running', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const period = '2026-11';
  const old = { payroll_id: 'one', employee_id: 'E1', period, status: 'PENDING', net_salary: 1 };
  let finishGenerate!: (rows: any[]) => void, finishRead!: (rows: any[]) => void;
  api.fetch.mockReset().mockResolvedValue([old]);
  api.generate.mockReset().mockReturnValue(new Promise(resolve => { finishGenerate = resolve; }));
  let handle: ReturnType<typeof usePayroll>;
  function Probe() { handle = usePayroll(); return null; }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await act(async () => handle.setSelectedPeriod(period));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    let generation!: Promise<unknown>;
    await act(async () => { generation = handle.generatePayroll(period); });
    api.fetch.mockReturnValueOnce(new Promise(resolve => { finishRead = resolve; }));
    await act(async () => { void client.refetchQueries({ queryKey: ['payroll', 'period', period] }); });
    await act(async () => { finishGenerate([{ ...old, net_salary: 100 }]); await generation; });
    await act(async () => { finishRead([old]); await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(handle!.payroll[0].net_salary).toBe(100);
  } finally { act(() => root.unmount()); client.clear(); }
});
