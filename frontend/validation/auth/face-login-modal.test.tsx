// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FaceLoginModal } from '../../src/features/auth/components/FaceLoginModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { loginWithFace, config, challenge } = vi.hoisted(() => ({ loginWithFace: vi.fn(), config: vi.fn(), challenge: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ loginWithFace }) }));
vi.mock('../../src/features/auth/api/faceLoginApi', () => ({ faceLoginApi: { config, challenge } }));

describe('Camera login dialog', () => {
  let host: HTMLDivElement, root: Root, stop: ReturnType<typeof vi.fn>, openCamera: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    stop = vi.fn();
    openCamera = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: openCamera } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YWJj');
    config.mockResolvedValue(true);
    challenge.mockResolvedValue({ challengeId: 'a'.repeat(32), expiresAt: Date.now() + 60000 });
    loginWithFace.mockResolvedValue({ success: true, role: 'employee' });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('opens camera, captures straight-face frames and releases camera after login', async () => {
    const success = vi.fn();
    let submitted: string[] = [];
    loginWithFace.mockImplementation(async (_id, frames) => { submitted = [...frames]; return { success: true, role: 'employee' }; });
    await act(async () => { root.render(<FaceLoginModal onClose={vi.fn()} onSuccess={success}/>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    const scan = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Bắt đầu nhận diện'))!;
    expect(scan.disabled).toBe(false);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('bật đăng nhập khuôn mặt');
    await act(async () => { scan.click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(submitted).toEqual(Array(8).fill('YWJj'));
    expect(loginWithFace).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('stops camera on unmount and never authenticates without scanning', async () => {
    await act(async () => { root.render(<FaceLoginModal onClose={vi.fn()} onSuccess={vi.fn()}/>); });
    await act(async () => root.unmount());
    expect(stop).toHaveBeenCalledOnce();
    expect(loginWithFace).not.toHaveBeenCalled();
    root = createRoot(host);
  });

  it('shows configuration failure without opening a camera', async () => {
    config.mockResolvedValue(false);
    await act(async () => { root.render(<FaceLoginModal onClose={vi.fn()} onSuccess={vi.fn()}/>); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('chưa được bật');
    expect(openCamera).not.toHaveBeenCalled();
  });
});
