// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../src/features/attendances/hooks/useDeviceSettings', () => ({ useDeviceSettings: () => ({ settings: { streamEnabled: true }, toggleStream: vi.fn() }) }));
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn().mockResolvedValue({ success: false }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
import { WebRTCPlayer } from '../../src/features/attendances/components/WebRTCPlayer';

it('keeps the same camera box in loading, failure, and retry states', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let failOffer: (error: Error) => void = () => {};
  vi.stubGlobal('RTCPeerConnection', class {
    addTransceiver() {}
    close() {}
    createOffer() { return new Promise((_resolve, reject) => { failOffer = reject; }); }
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<WebRTCPlayer />));
    const box = host.firstElementChild!;
    const size = box.className;
    expect(size).toContain('h-[500px]');
    expect(size).toContain('lg:h-[560px]');
    expect(host.textContent).toContain('Đang thiết lập');
    await act(async () => failOffer(new Error('Camera unavailable')));
    expect(host.textContent).toContain('Camera unavailable');
    expect(box.className).toBe(size);
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Thử kết nối lại'))!;
    await act(async () => retry.click());
    expect(host.textContent).toContain('Đang thiết lập');
    expect(box.className).toBe(size);
    expect(host.querySelector('video')?.className).toContain('absolute inset-0');
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
