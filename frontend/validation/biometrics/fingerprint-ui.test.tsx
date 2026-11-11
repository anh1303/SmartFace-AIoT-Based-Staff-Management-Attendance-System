// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const state = vi.hoisted(() => ({ role: 'manager', apiFetch: vi.fn() }));
vi.mock('../../src/api/client', () => ({ apiFetch: state.apiFetch }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: state.role, currentUser: { username: 'tester' } }) }));
import { FingerprintEnrollmentSection } from '../../src/features/biometrics/components/FingerprintEnrollmentSection';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
let client: QueryClient;
function render(element: React.ReactNode) { root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>); }
beforeEach(() => { state.role='manager'; state.apiFetch.mockReset(); client=new QueryClient(); host=document.createElement('div');document.body.appendChild(host);root=createRoot(host); });
afterEach(() => { act(() => root.unmount());host.remove(); });
const props = () => ({selectedDevice:'PI_A',onSelectDevice:vi.fn(),selectedFinger:'Ngón trỏ phải (Right Index)',onSelectFinger:vi.fn(),
 fingerprintStep:'IDLE' as const,fingerQualityScore:null,devices:[{device_id:'PI_A',ready:true,wak_verified:true,roundtrip_verified:true,
 capacity:300,attendance_enabled:false,polling_fallback:false,last_seen:new Date().toISOString(),error:null}],onSendIoTTrigger:vi.fn(),onOpenConfirmModal:vi.fn(),onCancel:vi.fn()});
it('cannot confirm before verified and does not invent image quality or online status', () => {
 act(() => render(<FingerprintEnrollmentSection {...props()} />));
 const confirm=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Xác nhận lưu mẫu')!;
 expect(confirm.disabled).toBe(true);
 expect(host.textContent).not.toMatch(/NFIQ|98.5|FAP30|\/100/);
 expect(host.textContent).toContain('Chế độ lấy mẫu');
});
it('shows raw match score and enables confirmation only after a real verified state', () => {
 const p=props();act(() => render(<FingerprintEnrollmentSection {...p} fingerprintStep="VERIFIED" fingerQualityScore={132} />));
 const confirm=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Xác nhận lưu mẫu')!;
 expect(confirm.disabled).toBe(false);act(()=>confirm.click());expect(p.onOpenConfirmModal).toHaveBeenCalledOnce();
 expect(host.textContent).toContain('132');expect(host.textContent).not.toContain('132%');
});
it('unavailable WAK prevents enrollment until an operator chooses fallback', () => {
 const p=props();p.devices[0].wak_verified=false;
 act(()=>render(<FingerprintEnrollmentSection {...p} />));
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Bắt đầu lấy mẫu thật')!.disabled).toBe(true);
});
it('keeps cancellation available while syncing and explains preservation of the old sample', () => {
 act(()=>render(<FingerprintEnrollmentSection {...props()} fingerprintStep="SYNCING" />));
 expect(host.textContent).toContain('mẫu cũ vẫn có hiệu lực');
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Hủy phiên')!.disabled).toBe(false);
});
it.each([[45, false], [91, true]])('uses the backend heartbeat window at %i seconds', (seconds, disabled) => {
  const p = props();
  p.devices[0].last_seen = new Date(Date.now() - seconds * 1000).toISOString();
  act(() => render(<FingerprintEnrollmentSection {...p} />));
  const start = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Bắt đầu lấy mẫu thật')!;
  expect(start.disabled).toBe(disabled);
});


it('shows a live enrollment on the selected Pi and prevents switching modes', () => {
  state.role = 'admin';
  const p = props();
  const device = { ...p.devices[0], attendance_enabled: true, enrollment_active: true };
  act(() => render(<FingerprintEnrollmentSection {...p} devices={[device]} />));
  expect(host.textContent).toContain('Đang lấy mẫu hoặc đồng bộ');
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Chuyển sang lấy mẫu')?.disabled).toBe(true);
});

it('lets an admin enable attendance beside the mode after explicit acceptance', async () => {
  state.role = 'admin';
  const p = props();
  const key = ['fingerprint-devices', 'tester'];
  client.setQueryData(key, p.devices);
  state.apiFetch.mockResolvedValue({ data: { ...p.devices[0], attendance_enabled: true } });
  act(() => render(<FingerprintEnrollmentSection {...p} />));
  const button = (label: string) => Array.from(host.querySelectorAll('button')).find(item => item.textContent === label)!;
  act(() => button('Chuyển sang chấm công').click());
  expect(state.apiFetch).not.toHaveBeenCalled();
  await act(async () => button('Xác nhận nghiệm thu và bật').click());
  expect(state.apiFetch).toHaveBeenCalledWith('/api/biometrics/fingerprint-devices/PI_A', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ attendance_enabled: true, acceptance_verified: true }),
  }));
  expect(client.getQueryData(key)).toEqual([expect.objectContaining({ attendance_enabled: true })]);
});
