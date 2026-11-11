// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ finalize: vi.fn(), unlock: vi.fn() }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/features/payrolls/api/payrollApi', () => ({
  fetchPayrollApi: async () => [], fetchBonusPenaltyApi: async () => null,
  finalizePayrollPeriodApi: calls.finalize, unlockPayrollPeriodApi: calls.unlock,
}));
import { usePayroll } from '../../src/features/payrolls/hooks/usePayroll';
import { PayrollFinalizeModal, PayrollUnlockModal } from '../../src/features/payrolls/components/PayrollActionModals';

it.each(['finalize', 'unlock'] as const)('%s keeps its dialog open and button busy until the backend finishes', async kind => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let finish!: (value: unknown) => void;
  calls[kind].mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const close = vi.fn();
  function Probe() {
    const payroll = usePayroll();
    const props = { isOpen: true, onClose: close, selectedPeriod: '2020-01', onConfirm: async () => {
      await (kind === 'finalize' ? payroll.finalizePayrollPeriod('2020-01') : payroll.unlockPayrollPeriod('2020-01'));
      close();
    } };
    return kind === 'finalize' ? <PayrollFinalizeModal {...props} totalExpense={1000}/> : <PayrollUnlockModal {...props}/>;
  }
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>));
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(kind === 'finalize' ? 'Đồng ý chốt' : 'Mở khóa chỉnh sửa'))!;
    await act(async () => { button.click(); button.click(); });
    expect(calls[kind]).toHaveBeenCalledTimes(1);
    expect(button.textContent).toContain(kind === 'finalize' ? 'Đang chốt lương…' : 'Đang mở khóa…');
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish([]); });
    expect(close).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); client.clear(); host.remove(); }
});
