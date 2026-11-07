// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  employees: [{ id: 'e1', employee_id: 'NV1', full_name: 'An', department: 'IT', status: 'ACTIVE', face_enrolled: false }],
  confirmFingerprint: vi.fn(),
  update: vi.fn(), toast: vi.fn(), enroll: vi.fn(), remove: vi.fn(), track: vi.fn(),
}));
vi.mock('../../src/context/AppContext', () => ({ useApp: () => ({ employees: state.employees, updateEmployee: state.update, showToast: state.toast }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin', currentUser: { employee_id: 'ADMIN' } }) }));
vi.mock('../../src/features/operations/OperationsProvider', () => ({ useOperations: () => ({ track: state.track }) }));
vi.mock('../../src/features/biometrics/api/biometricApi', () => ({ enrollFaceJobApi: state.enroll, deleteEmployeeBiometricsApi: state.remove }));
vi.mock('../../src/features/biometrics/hooks/useFingerprintEnrollment', () => ({ useFingerprintEnrollment: () => ({ step: 'VERIFIED', session: { match_score: 132 }, devices: [], confirm: state.confirmFingerprint, start: vi.fn(), cancel: vi.fn() }) }));
import { useBiometricEnrollment } from '../../src/features/biometrics/hooks/useBiometricEnrollment';
let model: ReturnType<typeof useBiometricEnrollment>, root: Root, host: HTMLDivElement, client: QueryClient;
function Probe() { model = useBiometricEnrollment(); return <p>{model.analyzingFace ? 'Đang tải ảnh' : 'Sẵn sàng'}</p>; }
beforeEach(async () => {
  vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); client = new QueryClient();
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter><Probe /></MemoryRouter></QueryClientProvider>));
});
afterEach(() => { act(() => root.unmount()); client.clear(); host.remove(); });
it('tracks an accepted face job without claiming enrollment completed or issuing a second avatar PUT', async () => {
  let resolve!: (value: unknown) => void;
  state.enroll.mockReturnValue(new Promise(r => { resolve = r; }));
  await act(async () => { model.setUploadedPhotos([1, 2, 3].map(i => ({ id: String(i), url: `image${i}`, name: 'Ảnh', tag: 'Mặt' }))); model.setFaceConfirmModal(true); });
  let pending: Promise<void>;
  await act(async () => { pending = model.handleConfirmFaceSave(); });
  expect(host.textContent).toContain('Đang tải ảnh'); expect(state.track).not.toHaveBeenCalled();
  const job = { jobId: 'job1', status: 'queued', label: 'Cập nhật khuôn mặt NV1' };
  await act(async () => { resolve(job); await pending; });
  expect(state.track).toHaveBeenCalledWith(job); expect(state.update).not.toHaveBeenCalled();
  expect(model.resultModalOpen).toBe(false); expect(model.currentEmp?.face_enrolled).toBe(false);
  expect(state.toast.mock.calls.some(call => call[1] === 'success')).toBe(false);
});
it('keeps the fingerprint confirmation open until the save is confirmed', async () => {
  let resolve!: (value: boolean) => void; state.confirmFingerprint.mockReturnValue(new Promise<boolean>(r => { resolve = r; }));
  await act(async () => model.setFingerConfirmModal(true));
  let pending: Promise<void>;
  await act(async () => { pending = model.handleConfirmFingerprintSave(); });
  expect(model.fingerConfirmModal).toBe(true);
  await act(async () => { resolve(true); await pending; });
  expect(model.fingerConfirmModal).toBe(false);
});
it('deletes faces through the biometric endpoint without sending an ineffective employee flag update', async () => {
  state.remove.mockResolvedValue(undefined);
  await act(async () => { await model.handleDeleteFaceId(state.employees[0] as any); });
  expect(state.remove).toHaveBeenCalledWith('NV1'); expect(state.update).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalledWith(expect.stringContaining('Đã xóa'), 'success');
});
