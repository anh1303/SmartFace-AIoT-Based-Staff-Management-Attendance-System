// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NotificationItem } from '../../src/features/notifications/components/NotificationItem';

it.each([['success', 'text-emerald-700'], ['info', 'text-blue-700'], ['warning', 'text-blue-700'], ['error', 'text-rose-700']] as const)('shows only the %s title and toggles full details without deleting the notification', async (type, color) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const read = vi.fn(async () => {}), remove = vi.fn(async () => {});
  const title = type === 'error' ? 'Không thể phân công ca làm việc' : 'Phân công ca làm việc thành công';
  const description = 'Đã phân công ca sáng cho Nguyễn Văn A (NV001) vào ngày 09/11/2026.';
  try {
    await act(async () => root.render(<NotificationItem item={{ id: '1', title, message: description, type, timestamp: new Date().toISOString(), read: false }} onMarkRead={read} onRemove={remove}/>));
    expect(host.textContent).toContain(title);
    expect(host.textContent).not.toContain(description);
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(toggle).not.toBeNull(); expect(toggle.className).toContain(color);
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain(description); expect(read).toHaveBeenCalledWith('1');
    await act(async () => toggle.click());
    expect(host.textContent).not.toContain(description); expect(remove).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Xóa thông báo"]')!.click());
    expect(remove).toHaveBeenCalledWith('1');
  } finally { act(() => root.unmount()); host.remove(); }
});
