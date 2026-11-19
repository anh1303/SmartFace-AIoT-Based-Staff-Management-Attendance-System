// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('../../src/api/client', () => ({ api: { get: async () => ({ data: [] }), patch: async () => ({ success: true }) } }));
import { NotificationProvider, useNotifications } from '../../src/features/notifications/context/NotificationContext';
import { ToastProvider, useToast } from '../../src/context/ToastContext';
import { ToastContainer } from '../../src/components/common/Toast';
import { ActionButton } from '../../src/components/common/ActionFeedback';
import { FloatingNotificationBubble } from '../../src/features/notifications/components/FloatingNotificationBubble';
import { Modal } from '../../src/components/common/Modal';

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
    expect(document.body.textContent).toContain(title); expect(document.body.textContent).not.toContain(description);
    const card = document.querySelector<HTMLElement>('[data-toast-layer] article')!;
    await act(async () => card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    await act(async () => card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await act(async () => card.click());
    expect(history.isOpen).toBe(true);
    expect(toast.toasts).toHaveLength(0);
    expect(history.notifications[0].message).toBe(description);
  } finally { act(() => root.unmount()); host.remove(); sessionStorage.clear(); vi.useRealTimers(); }
});

it('shows at most two cards, replaces the oldest, and expires each after five seconds without losing history', async () => {
  vi.useFakeTimers(); sessionStorage.setItem('userSession', 'signed-in');
  let toast!: ReturnType<typeof useToast>, history!: ReturnType<typeof useNotifications>;
  function Probe() { toast = useToast(); history = useNotifications(); return <ToastContainer/>; }
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<NotificationProvider><ToastProvider><Probe/></ToastProvider></NotificationProvider>));
    await act(async () => toast.showToast('First', 'error'));
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => toast.showToast('Second', 'warning'));
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => toast.showToast('Third', 'info'));
    expect(toast.toasts.map(t => t.message)).toEqual(['Second', 'Third']);
    await act(async () => vi.advanceTimersByTime(3000));
    expect(toast.toasts).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(toast.toasts.map(t => t.message)).toEqual(['Third']);
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng thông báo"]')!.click());
    expect(toast.toasts).toHaveLength(0); expect(history.isOpen).toBe(false);
    expect(history.notifications).toHaveLength(3);
    await act(async () => toast.showToast('Fourth'));
    await act(async () => vi.advanceTimersByTime(4999));
    expect(toast.toasts).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(toast.toasts).toHaveLength(0);
  } finally { act(() => root.unmount()); host.remove(); sessionStorage.clear(); vi.useRealTimers(); }
});

it('routes action failures to a single toast instead of inline feedback when already reported by the action', async () => {
  let toast!: ReturnType<typeof useToast>;
  function Probe() { toast = useToast(); return <><ActionButton onClick={async () => {
    toast.showToast('Nhân viên NV01: Không thể xóa hồ sơ.', 'error', 'Không thể xóa nhân viên');
    throw new Error('Không thể xóa hồ sơ');
  }}>Xóa</ActionButton><ToastContainer/></>; }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<ToastProvider><Probe/></ToastProvider>));
    await act(async () => host.querySelector('button')!.click());
    expect(toast.toasts).toHaveLength(1);
    expect(host.querySelector('.sf-feedback.error')).toBeNull();
  } finally { act(() => root.unmount()); host.remove(); }
});

it('opens notification history above an existing modal and closes history without closing that modal', async () => {
  sessionStorage.setItem('userSession', 'signed-in');
  const close = vi.fn();
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<NotificationProvider><ToastProvider>
      <FloatingNotificationBubble/>
      <Modal isOpen onClose={close} title="Employee action"><ActionButton onClick={async () => { throw new Error('Server unavailable'); }}>Save employee</ActionButton></Modal>
      <ToastContainer/>
    </ToastProvider></NotificationProvider>));
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Save employee')!.click());
    expect(document.querySelector('[data-toast-layer]')).not.toBeNull();
    expect(document.querySelector('.sf-feedback.error')).toBeNull();
    const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    try {
      document.querySelector<HTMLButtonElement>('[aria-label^="Mở thông báo:"]')!.focus();
      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
    } finally { rects.mockRestore(); }
    const card = document.querySelector<HTMLElement>('[data-toast-layer] article')!;
    await act(async () => card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    await act(async () => card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await act(async () => card.click());
    const panel = document.querySelector<HTMLElement>('section[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('Không thực hiện được thao tác');
    await act(async () => panel.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click());
    expect(panel.textContent).toContain('Server unavailable');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('section[role="dialog"]')).toBeNull();
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  } finally { act(() => root.unmount()); host.remove(); sessionStorage.clear(); }
});

it('gives a repeated unhandled action failure a new five-second card', async () => {
  vi.useFakeTimers();
  let toast!: ReturnType<typeof useToast>;
  function Probe() { toast = useToast(); return <ActionButton onClick={async () => { throw new Error('Request failed'); }}>Retry</ActionButton>; }
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<ToastProvider><Probe/></ToastProvider>));
    await act(async () => host.querySelector('button')!.click());
    const firstId = toast.toasts[0].id;
    await act(async () => vi.advanceTimersByTime(4000));
    await act(async () => host.querySelector('button')!.click());
    expect(toast.toasts).toHaveLength(2);
    expect(toast.toasts[1].id).not.toBe(firstId);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(toast.toasts).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(4000));
    expect(toast.toasts).toHaveLength(0);
  } finally { act(() => root.unmount()); host.remove(); vi.useRealTimers(); }
});

it('dismisses toast safely when NotificationProvider is absent and invokes optional onOpenNotifications callback', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let toast!: ReturnType<typeof useToast>;
  const onOpenNotifications = vi.fn();
  function Probe({ withCallback }: { withCallback?: boolean }) {
    toast = useToast();
    return <ToastContainer onOpenNotifications={withCallback ? onOpenNotifications : undefined} />;
  }
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<ToastProvider><Probe /></ToastProvider>));
    await act(async () => toast.showToast('Không có NotificationProvider', 'info'));
    expect(toast.toasts).toHaveLength(1);
    const card = document.querySelector<HTMLElement>('[data-toast-layer] article')!;
    await act(async () => card.click());
    expect(toast.toasts).toHaveLength(0);
    expect(onOpenNotifications).not.toHaveBeenCalled();

    await act(async () => root.render(<ToastProvider><Probe withCallback /></ToastProvider>));
    await act(async () => toast.showToast('Có callback prop', 'info'));
    const card2 = document.querySelector<HTMLElement>('[data-toast-layer] article')!;
    await act(async () => card2.click());
    expect(toast.toasts).toHaveLength(0);
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); host.remove(); }
});
