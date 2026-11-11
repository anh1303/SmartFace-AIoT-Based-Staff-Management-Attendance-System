// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ request: vi.fn() }));
const user = vi.hoisted(() => ({ username: 'admin' }));
vi.mock('../../src/api/client', () => ({ apiFetch: api.request }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: user }), getActiveSessionId: () => 1 }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
import { useFingerprintEnrollment } from '../../src/features/biometrics/hooks/useFingerprintEnrollment';
import { ActionButton } from '../../src/components/common/ActionFeedback';

it('keeps the save button busy and the confirmation key until Pi acknowledges the new template', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  sessionStorage.clear();
  const session = { id: 'session-1', employee_id: 'NV1', device_id: 'pi', status: 'VERIFIED', finger_name: 'Ngón trỏ', error: null, match_score: 100 };
  let acknowledged = false, confirmed = false;
  api.request.mockImplementation(async (path: string) => ({ data:
    path.endsWith('fingerprint-devices') ? [] : path.endsWith('/confirm')
      ? (confirmed = true, { ...session, status: 'SYNCING' })
      : { ...session, status: acknowledged ? 'COMPLETED' : confirmed ? 'SYNCING' : 'VERIFIED' }
  }));
  const toast = vi.fn();
  function Probe() {
    const model = useFingerprintEnrollment('NV1', false, toast);
    return <ActionButton busyLabel="Đang đồng bộ…" onClick={() => model.confirm()}>Lưu vân tay</ActionButton>;
  }
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  sessionStorage.setItem('fingerprint-session:admin:NV1', session.id);
  client.setQueryData(['fingerprint-current', 'admin', 'NV1'], session);
  client.setQueryData(['fingerprint-session', 'admin', 'NV1', session.id], session);
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { host.querySelector('button')!.click(); });
    expect(host.textContent).toContain('Đang đồng bộ…');
    expect(sessionStorage.getItem('fingerprint-confirm:session-1')).toBeTruthy();
    expect(toast).not.toHaveBeenCalledWith(expect.any(String), 'success', expect.any(String));
    acknowledged = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(host.textContent).toContain('Lưu vân tay');
    expect(sessionStorage.getItem('fingerprint-confirm:session-1')).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('trên thiết bị pi'), 'success', 'Lưu vân tay thành công');
  } finally { act(() => root.unmount()); client.clear(); host.remove(); sessionStorage.clear(); vi.useRealTimers(); }
});
