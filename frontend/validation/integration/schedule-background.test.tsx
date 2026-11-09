// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ copy: vi.fn(), batch: vi.fn(), single: vi.fn(), track: vi.fn(), toast: vi.fn() }));
vi.mock('../../src/features/operations/OperationsProvider', () => ({ useOperations: () => ({ jobs: [], track: state.track }) }));
vi.mock('../../src/features/schedules/api/shiftApi', () => ({ submitScheduleCopy: state.copy, submitScheduleBatch: state.batch }));
vi.mock('../../src/context/AppContext', () => ({ useApp: () => ({ employees: [{ employee_id: 'NV1', full_name: 'An', department: 'IT', status: 'ACTIVE', position: 'Dev' }], workShifts: [], assignOrUpdateShift: state.single, showToast: state.toast }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin', currentUser: { employee_id: 'ADMIN' } }) }));
vi.mock('../../src/context/EmployeeContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useEmployeeContext: () => ({ ...app.useApp(), isLoading: false, isError: false }) }) });
vi.mock('../../src/context/ShiftContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useShiftContext: () => ({ ...app.useApp(), isLoading: false, isError: false, refetchShifts: vi.fn() }) }) });
vi.mock('../../src/features/employees', () => ({ useDepartmentPositions: () => ({ departmentOptions: ['IT'], positionOptions: ['Dev'], dbDepartments: [] }) }));
import { ManagerSchedule } from '../../src/pages/manager/ManagerSchedule';

it('keeps the copy button pending until saving finishes, without posting each cell', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T10:00:00+07:00'));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); const client = new QueryClient();
  let resolve!: (value: unknown) => void;
  const job = { jobId: 'job1', type: 'shifts.batch', status: 'succeeded' }; state.copy.mockReturnValue(new Promise(r => { resolve = r; }));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter><ManagerSchedule /></MemoryRouter></QueryClientProvider>));
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Sao chép tuần trước'))!.click(); });
    expect(state.copy).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Đang sao chép…');
    expect(state.toast).not.toHaveBeenCalledWith(expect.any(String), 'success', expect.any(String));
    await act(async () => { resolve(job); });
    expect(state.copy).toHaveBeenCalledWith({ sourceMonday: '2026-10-26', targetMonday: '2026-11-02', employeeIds: ['NV1'], expectedTargetVersions: {
      'NV1:2026-11-02': null, 'NV1:2026-11-03': null, 'NV1:2026-11-04': null, 'NV1:2026-11-05': null, 'NV1:2026-11-06': null, 'NV1:2026-11-07': null, 'NV1:2026-11-08': null,
    } });
    expect(state.single).not.toHaveBeenCalled(); expect(state.track).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.stringContaining('cho 1 nhân viên'), 'success', 'Sao chép lịch làm việc thành công');
  } finally { act(() => root.unmount()); client.clear(); host.remove(); vi.useRealTimers(); }
});

vi.mock('../../src/context/ToastContext', async () => { const app = await import('../../src/context/AppContext'); return { useToast: () => app.useApp() }; });
