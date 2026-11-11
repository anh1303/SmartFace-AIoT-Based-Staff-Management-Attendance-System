// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ ack: false, send: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }), getActiveSessionId: () => 1 }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../src/features/devices/components/DeviceKioskSettingsPanel', () => ({ DeviceKioskSettingsPanel: () => null }));
vi.mock('../../src/features/devices', async () => {
  const { confirmsRequestedMode } = await import('../../src/features/devices/deviceModeState');
  const device = { id: 'pi', name: 'Pi', location: 'Sảnh', status: 'ONLINE', lastSeen: null };
  return { confirmsRequestedMode, DeviceKioskSettingsPanel: () => null, validDeviceIp: () => true, useDeviceRealtime: () => {}, deviceApi: {
    list: async () => [device], get: async () => device, setMode: state.send,
    mode: async () => ({ deviceId: 'pi', mode: state.ack ? 'CHECK_IN' : 'AUTO', confirmed: state.ack, lastUpdated: new Date().toISOString() }),
  } };
});
import { ManagerDevices } from '../../src/pages/manager/ManagerDevices';

it('locks sibling mode buttons throughout the ACK wait, even after the POST has resolved', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); state.ack = false;
  state.send.mockResolvedValue({ deviceId: 'pi', mode: 'CHECK_IN', confirmed: false });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/devices/pi']}><Routes><Route path="/devices/:id" element={<ManagerDevices/>}/></Routes></MemoryRouter></QueryClientProvider>));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const modeButtons = [...host.querySelectorAll('button')].filter(button => /Chuyển sang|Chế độ Tự động/.test(button.textContent || ''));
    expect(modeButtons).toHaveLength(3);
    await act(async () => { modeButtons[0].click(); });
    expect(host.textContent).toContain('Đang chuyển chế độ…');
    expect(modeButtons.every(button => button.disabled)).toBe(true);
    await act(async () => { modeButtons[1].click(); });
    expect(state.send).toHaveBeenCalledTimes(1);
    state.ack = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(modeButtons.every(button => !button.disabled)).toBe(true);
    expect(host.textContent).not.toContain('Đang chuyển chế độ…');
  } finally { act(() => root.unmount()); client.clear(); host.remove(); vi.useRealTimers(); }
});
