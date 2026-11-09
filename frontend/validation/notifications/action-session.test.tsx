// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const patch = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/client', () => ({ api: { get: async () => ({ data: [] }), patch } }));
import { NotificationProvider, useNotifications } from '../../src/features/notifications/context/NotificationContext';
it('ignores a late delete confirmation after the account has changed', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.setItem('userSession', 'account-a');
  let finish!: (value: unknown) => void;
  patch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  let model: ReturnType<typeof useNotifications>;
  function Probe() { model = useNotifications(); return <p>{model.notifications.map(n => n.message).join(',')}</p>; }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<NotificationProvider><Probe/></NotificationProvider>));
    await act(async () => model.addNotification({ message: 'old' }));
    let pending!: Promise<void>;
    await act(async () => { pending = model.clearAll(); });
    expect(host.textContent).toContain('old');
    sessionStorage.setItem('userSession', 'account-b');
    await act(async () => { await model.clearAll(true); model.addNotification({ message: 'new' }); });
    await act(async () => { finish({ success: true }); await pending; });
    expect(host.textContent).toBe('new');
  } finally { act(() => root.unmount()); host.remove(); sessionStorage.clear(); }
});
