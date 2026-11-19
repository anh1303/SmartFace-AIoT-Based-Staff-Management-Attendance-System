// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

vi.mock('../../src/features/auth/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }));
vi.mock('../../src/features/devices', async () => {
  const actual = await vi.importActual<typeof import('../../src/features/devices')>('../../src/features/devices');
  return {
    ...actual,
    useDeviceSettings: () => ({ settings: { streamEnabled: true }, toggleStream: vi.fn() }),
  };
});
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn().mockResolvedValue({ success: false }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
import { WebRTCPlayer } from '../../src/features/attendances/components/WebRTCPlayer';
import * as attendancesFeature from '../../src/features/attendances';
import { useDeviceSettings } from '../../src/features/devices/useDeviceSettings';
import * as client from '../../src/api/client';

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

it('exports useDeviceSettings from features/devices (not features/attendances) and ignores stale responses from a previous device', async () => {
  expect('useDeviceSettings' in attendancesFeature).toBe(false);

  let resolveDevA!: (val: any) => void;
  const devAPromise = new Promise(resolve => { resolveDevA = resolve; });

  vi.mocked(client.apiFetch).mockImplementation((url: string) => {
    if (url.includes('/api/devices/DEV_A/settings')) return devAPromise as any;
    if (url.includes('/api/devices/DEV_B/settings')) {
      return Promise.resolve({
        success: true,
        data: { deviceId: 'DEV_B', online: true, fps: 30, volume: 88, isMuted: false, showFps: true, streamEnabled: true, maxFaces: 4, wifi: { connected: true, ssid: 'B', signalStrength: 90, ip: '10.0.0.2' }, bluetooth: { connected: false, deviceName: '', status: 'disconnected' } },
      }) as any;
    }
    return Promise.resolve({ success: false }) as any;
  });

  let latestSettings: any = null;
  function Probe({ deviceId }: { deviceId: string }) {
    const { settings } = useDeviceSettings(deviceId);
    latestSettings = settings;
    return <div>{settings.deviceId}:{settings.volume}</div>;
  }

  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Probe deviceId="DEV_A" />));
    await act(async () => root.render(<Probe deviceId="DEV_B" />));
    expect(latestSettings.deviceId).toBe('DEV_B');
    expect(latestSettings.volume).toBe(88);

    // Late response from DEV_A arrives after switching to DEV_B
    await act(async () => {
      resolveDevA({
        success: true,
        data: { deviceId: 'DEV_A', online: true, fps: 15, volume: 12, isMuted: false, showFps: true, streamEnabled: true, maxFaces: 2, wifi: { connected: true, ssid: 'A', signalStrength: 50, ip: '10.0.0.1' }, bluetooth: { connected: false, deviceName: '', status: 'disconnected' } },
      });
    });

    expect(latestSettings.deviceId).toBe('DEV_B');
    expect(latestSettings.volume).toBe(88);
  } finally {
    act(() => root.unmount());
  }
});
