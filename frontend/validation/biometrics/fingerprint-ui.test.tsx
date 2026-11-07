// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({role:'manager'}) }));
import { FingerprintEnrollmentSection } from '../../src/features/biometrics/components/FingerprintEnrollmentSection';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(() => { host=document.createElement('div');document.body.appendChild(host);root=createRoot(host); });
afterEach(() => { act(() => root.unmount());host.remove(); });
const props = () => ({selectedDevice:'PI_A',onSelectDevice:vi.fn(),selectedFinger:'Ngón trỏ phải (Right Index)',onSelectFinger:vi.fn(),
 fingerprintStep:'IDLE' as const,fingerQualityScore:null,devices:[{device_id:'PI_A',ready:true,wak_verified:true,roundtrip_verified:true,
 capacity:300,attendance_enabled:false,polling_fallback:false,last_seen:new Date().toISOString(),error:null}],onSendIoTTrigger:vi.fn(),onOpenConfirmModal:vi.fn(),onCancel:vi.fn()});
it('cannot confirm before verified and does not invent image quality or online status', () => {
 act(() => root.render(<FingerprintEnrollmentSection {...props()} />));
 const confirm=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Xác nhận lưu mẫu')!;
 expect(confirm.disabled).toBe(true);
 expect(host.textContent).not.toMatch(/NFIQ|98.5|FAP30|\/100/);
 expect(host.textContent).toContain('chế độ thử nghiệm');
});
it('shows raw match score and enables confirmation only after a real verified state', () => {
 const p=props();act(() => root.render(<FingerprintEnrollmentSection {...p} fingerprintStep="VERIFIED" fingerQualityScore={132} />));
 const confirm=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Xác nhận lưu mẫu')!;
 expect(confirm.disabled).toBe(false);act(()=>confirm.click());expect(p.onOpenConfirmModal).toHaveBeenCalledOnce();
 expect(host.textContent).toContain('132');expect(host.textContent).not.toContain('132%');
});
it('unavailable WAK prevents enrollment until an operator chooses fallback', () => {
 const p=props();p.devices[0].wak_verified=false;
 act(()=>root.render(<FingerprintEnrollmentSection {...p} />));
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Bắt đầu lấy mẫu thật')!.disabled).toBe(true);
});
it('keeps cancellation available while syncing and explains preservation of the old sample', () => {
 act(()=>root.render(<FingerprintEnrollmentSection {...props()} fingerprintStep="SYNCING" />));
 expect(host.textContent).toContain('mẫu cũ vẫn có hiệu lực');
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Hủy phiên')!.disabled).toBe(false);
});
