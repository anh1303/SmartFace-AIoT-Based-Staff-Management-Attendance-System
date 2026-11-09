// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('../../src/api/client', () => ({ api: { get: async () => ({ data: [] }), patch: async () => ({ success: true }) } }));
import { NotificationProvider, useNotifications } from '../../src/features/notifications/context/NotificationContext';
import { ToastProvider, useToast } from '../../src/context/ToastContext';
import { ToastContainer } from '../../src/components/common/Toast';

it('carries the action title and detailed description from toast to notification history', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); sessionStorage.setItem('userSession', 'signed-in');
  let toast!: ReturnType<typeof useToast>, history!: ReturnType<typeof useNotifications>;
  function Probe() { toast = useToast(); history = useNotifications(); return <ToastContainer/>; }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const title = 'Xóa nhân viên thành công', description = 'Đã xóa hồ sơ Nguyễn Văn An (NV001) và tài khoản liên kết.';
  try {
    await act(async () => root.render(<NotificationProvider><ToastProvider><Probe/></ToastProvider></NotificationProvider>));
    await act(async () => toast.showToast(description, 'success', title));
    expect(history.notifications[0]).toMatchObject({ title, message: description, type: 'success' });
    expect(host.textContent).toContain(title); expect(host.textContent).not.toContain(description);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
    expect(host.textContent).toContain(description);
  } finally { act(() => root.unmount()); host.remove(); sessionStorage.clear(); vi.useRealTimers(); }
});
