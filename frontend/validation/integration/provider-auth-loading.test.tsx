// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ currentUser: null as null | { username: string }, isInitializing: false }));
const reads = vi.hoisted(() => ({ employees: vi.fn(), shifts: vi.fn(), payroll: vi.fn(), policy: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => state, getActiveSessionId: () => 1 }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/features/employees/api/employeeApi', () => ({ fetchEmployeesApi: reads.employees }));
vi.mock('../../src/features/schedules/api/shiftApi', () => ({ fetchShiftsApi: reads.shifts }));
vi.mock('../../src/features/payrolls/api/payrollApi', () => ({ fetchPayrollApi: reads.payroll, fetchBonusPenaltyApi: reads.policy }));
import { EmployeeProvider } from '../../src/context/EmployeeContext';
import { ShiftProvider } from '../../src/context/ShiftContext';
import { PayrollProvider } from '../../src/context/PayrollContext';

it('starts shared data reads after the authenticated session is ready', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.values(reads).forEach(read => read.mockResolvedValue([]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const render = () => <QueryClientProvider client={client}><EmployeeProvider><ShiftProvider><PayrollProvider><span>app</span></PayrollProvider></ShiftProvider></EmployeeProvider></QueryClientProvider>;
  try {
    await act(async () => { root.render(render()); });
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
    state.currentUser = { username: 'employee' };
    await act(async () => { root.render(render()); });
    for (const read of Object.values(reads)) expect(read).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount()); client.clear(); host.remove(); state.currentUser = null;
  }
});
