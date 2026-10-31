// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../../src/features/notifications/context/NotificationContext';

const patch = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock('../../src/api/client', () => ({ api: { get: vi.fn(async () => ({ data: [] })), patch } }));

function Controls() {
  const { clearAll } = useNotifications();
  return <><button onClick={() => clearAll(true)}>logout</button><button onClick={() => clearAll()}>delete</button></>;
}

afterEach(() => { patch.mockClear(); sessionStorage.clear(); });
describe('durable notifications', () => {
  it('clears only local state for logout but deletes server items on explicit deletion', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<NotificationProvider><Controls /></NotificationProvider>); });
    await act(async () => { container.querySelectorAll('button')[0].click(); });
    expect(patch).not.toHaveBeenCalled();
    await act(async () => { container.querySelectorAll('button')[1].click(); });
    expect(patch).toHaveBeenCalledWith('/notifications', { action: 'delete' });
    await act(async () => { root.unmount(); });
    container.remove();
  });
});
