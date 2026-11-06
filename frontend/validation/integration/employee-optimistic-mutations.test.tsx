// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ fetchEmployeesApi: vi.fn(), createEmployeeApi: vi.fn(), updateEmployeeApi: vi.fn(), deleteEmployeeApi: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ id: 1 }));
vi.mock('../../src/context/AuthContext', () => ({ getActiveSessionId: () => session.id }));
vi.mock('../../src/features/employees/api/employeeApi', () => api);
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
import { useEmployees } from '../../src/features/employees/hooks/useEmployees';
import { ApiError } from '../../src/api/client';
const original = { id: 'uuid1', employee_id: 'NV1', full_name: 'An', department: 'IT', position: 'Dev', phone: '', email: 'an@example.com', status: 'ACTIVE' as const, face_enrolled: false, fingerprint_enrolled: false, created_at: '2026-11-06', updated_at: '2026-11-06' };
let model: ReturnType<typeof useEmployees>, root: Root, host: HTMLDivElement, client: QueryClient;
function Probe() { model = useEmployees(); return <div>{model.employees.map(e => e.full_name).join(',')}</div>; }
beforeEach(async () => {
  vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  session.id = 1;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['employees'], [original]); api.fetchEmployeesApi.mockResolvedValue([original]);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
});
it('ignores a late save result after the account session has changed', async () => {
  let resolve!: (v: unknown) => void;
  api.updateEmployeeApi.mockReturnValue(new Promise(r => { resolve = r; }));
  let pending: Promise<unknown>;
  await act(async () => { pending = model.updateEmployee('NV1', { full_name: 'Bình' }); });
  session.id = 2;
  client.setQueryData(['employees'], [{ ...original, id: 'other', employee_id: 'OTHER', full_name: 'Người dùng mới' }]);
  toast.mockClear();
  await act(async () => { resolve({ ...original, full_name: 'Bình' }); await pending; });
  expect(client.getQueryData<any[]>(['employees'])![0].employee_id).toBe('OTHER');
  expect(toast).not.toHaveBeenCalled();
});
afterEach(() => { act(() => root.unmount()); client.clear(); host.remove(); });
it('shows the edited value while the server is slow and tells the user it is saving', async () => {
  let resolve!: (v: unknown) => void;
  api.updateEmployeeApi.mockReturnValue(new Promise(r => { resolve = r; }));
  let pending: Promise<unknown>;
  await act(async () => { pending = model.updateEmployee('NV1', { full_name: 'Bình' }); });
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  expect(host.textContent).toContain('Bình'); expect(toast).toHaveBeenCalledWith(expect.stringContaining('Đang lưu'), 'info');
  await act(async () => { resolve({ ...original, full_name: 'Bình chuẩn' }); await pending; });
  expect(client.getQueryData<any[]>(['employees'])![0].full_name).toBe('Bình chuẩn');
});
it('restores only the failed employee and reports the failure', async () => {
  let reject!: (v: Error) => void;
  api.updateEmployeeApi.mockReturnValue(new Promise((_, r) => { reject = r; }));
  let pending: Promise<unknown>;
  await act(async () => { pending = model.updateEmployee('NV1', { full_name: 'Bình' }); });
  client.setQueryData(['employees'], (rows: any[]) => [...rows, { ...original, id: 'uuid2', employee_id: 'NV2', full_name: 'Chi' }]);
  await act(async () => { reject(new Error('Không có quyền')); await pending!.catch(() => {}); });
  expect(client.getQueryData<any[]>(['employees'])!.map(e => e.full_name)).toEqual(['An', 'Chi']);
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('Không có quyền'), 'error');
});
it('does not roll back a newer server update when an older request fails', async () => {
  let reject!: (v: Error) => void;
  api.updateEmployeeApi.mockReturnValue(new Promise((_, r) => { reject = r; }));
  let pending: Promise<unknown>;
  await act(async () => { pending = model.updateEmployee('NV1', { full_name: 'Bình' }); });
  client.setQueryData(['employees'], [{ ...original, full_name: 'Tên mới từ server', updated_at: '2026-11-07' }]);
  await act(async () => { reject(new Error('Xung đột')); await pending!.catch(() => {}); });
  expect(client.getQueryData<any[]>(['employees'])![0].full_name).toBe('Tên mới từ server');
});
it('refreshes the server version after conflict so the next edit can succeed', async () => {
  api.fetchEmployeesApi.mockResolvedValue([{ ...original, full_name: 'Đã đổi từ tab khác', updated_at: '2026-11-07' }]);
  api.updateEmployeeApi.mockRejectedValue(new ApiError('Xung đột', 409));
  await act(async () => { await model.updateEmployee('NV1', { full_name: 'Bình' }).catch(() => {}); await new Promise(r => setTimeout(r, 10)); });
  expect(client.getQueryData<any[]>(['employees'])![0].updated_at).toBe('2026-11-07');
  api.updateEmployeeApi.mockResolvedValue({ ...original, full_name: 'Bình' });
  await act(async () => { await model.updateEmployee('NV1', { full_name: 'Bình' }); });
  expect(api.updateEmployeeApi).toHaveBeenLastCalledWith('NV1', expect.objectContaining({ updated_at: '2026-11-07' }));
});
