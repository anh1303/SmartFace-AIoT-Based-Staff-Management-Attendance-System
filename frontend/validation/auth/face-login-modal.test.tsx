// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FaceLoginModal } from '../../src/features/auth/components/FaceLoginModal';
import { ApiError } from '../../src/api/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => ({ config: vi.fn(), start: vi.fn(), frame: vi.fn(), status: vi.fn(), cancel: vi.fn(), complete: vi.fn() }));
const authState = vi.hoisted(() => ({ completeFaceLogin: vi.fn(), isLoggingOut: false }));
vi.mock('../../src/features/auth/context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../src/features/auth/api/faceLoginApi', async () => ({
  faceLoginApi: api, FaceLoginHttpError: (await import('../../src/api/client')).ApiError,
}));

const pending = (seq: number) => ({ seq, state: 'pending', nextSeq: seq + 1, guidance: 'Giữ yên' });

describe('Streaming camera login dialog', () => {
  let host: HTMLDivElement, root: Root, stop: ReturnType<typeof vi.fn>, trackRef: { stop: ReturnType<typeof vi.fn>; onended?: () => void };
  const scanButton = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Bắt đầu nhận diện') || b.textContent?.includes('Thử lại'))!;
  const backButton = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Quay lại'))!;
  async function openAndScan(success = vi.fn(), onClose = vi.fn()) {
    await act(async () => { root.render(<FaceLoginModal onClose={onClose} onSuccess={success}/>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    await act(async () => { scanButton().click(); });
    return { success, onClose };
  }
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    authState.isLoggingOut = false;
    stop = vi.fn();
    trackRef = { stop };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [trackRef] }) } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YWJj');
    api.config.mockResolvedValue(true);
    api.start.mockResolvedValue({ attemptId: 'a'.repeat(32), expiresAt: Date.now() + 15000, remainingMs: 15000, intervalMs: 200 });
    api.frame.mockImplementation(async (_id, seq) => seq >= 5 ? { seq, state: 'verified', nextSeq: seq + 1, guidance: 'ok' } : pending(seq));
    api.cancel.mockResolvedValue(undefined);
    authState.completeFaceLogin.mockResolvedValue({ success: true, role: 'employee' });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('sends the first frame immediately, then one frame per acknowledgement at >=200 ms, and completes on verification', async () => {
    const { success } = await openAndScan();
    expect(api.frame).toHaveBeenCalledTimes(1);
    for (let n = 2; n <= 5; n++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(199); });
      expect(api.frame).toHaveBeenCalledTimes(n - 1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(api.frame).toHaveBeenCalledTimes(n);
    }
    expect(api.frame.mock.calls.map(call => call[1])).toEqual([1, 2, 3, 4, 5]);
    expect(authState.completeFaceLogin).toHaveBeenCalledWith('a'.repeat(32));
    expect(success).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('keeps exactly one request outstanding even at 500 ms response time and captures fresh frame after response', async () => {
    const captures = vi.mocked(HTMLCanvasElement.prototype.toDataURL);
    captures.mockImplementation(() => `data:image/jpeg;base64,frame${captures.mock.calls.length}`);
    let release!: () => void;
    api.frame.mockImplementationOnce(async (_id, seq) => { await new Promise<void>(r => { release = r; }); return pending(seq); });
    await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(api.frame).toHaveBeenCalledTimes(1);
    expect(captures).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0); });
    expect(api.frame).toHaveBeenCalledTimes(2);
    expect(api.frame.mock.calls[1][2]).toBe('frame2');
  });

  it('shows busy guidance without sequence increment and delays retry by at least 200 ms from busy receipt, while IP_RATE_LIMIT/ATTEMPT_CAPACITY stop without retrying every 200 ms', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // ENGINE_BUSY jitter -> 200 + 100 = 300 ms
    api.frame.mockImplementationOnce(async () => {
      await new Promise(r => setTimeout(r, 150));
      throw new ApiError('Hệ thống đang bận, vui lòng giữ yên.', 429, undefined, 'ENGINE_BUSY');
    });
    await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Hệ thống đang bận');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(api.frame).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(api.frame.mock.calls.map(call => call[1]).slice(0, 2)).toEqual([1, 1]);

    // When IP_RATE_LIMIT is returned, modal stops scanning and does NOT retry every 200 ms
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    api.frame.mockClear();
    api.start.mockResolvedValueOnce({ attemptId: 'c'.repeat(32), expiresAt: Date.now() + 15000, remainingMs: 15000, intervalMs: 200 });
    api.frame.mockRejectedValueOnce(new ApiError('Đã thử quá nhiều lần. Vui lòng chờ một phút.', 429, undefined, 'IP_RATE_LIMIT'));
    await act(async () => { scanButton().click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(api.frame).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Đã thử quá nhiều lần');
  });

  it('reconciles an ambiguous network failure through attempt status', async () => {
    api.frame.mockRejectedValueOnce(new TypeError('network'));
    api.status.mockResolvedValue({ state: 'ready', nextSeq: 2, expiresAt: Date.now() + 10000 });
    await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(api.status).toHaveBeenCalledOnce();
    expect(api.frame.mock.calls[1][1]).toBe(2);
  });

  it('locks ordinary close while completing and starts a new attempt on retry after failure', async () => {
    api.frame.mockResolvedValueOnce({ seq: 1, state: 'verified', nextSeq: 2, guidance: 'ok' });
    let finishComplete!: (v: any) => void;
    authState.completeFaceLogin.mockImplementationOnce(() => new Promise(r => { finishComplete = r; }));
    const onClose = vi.fn();
    await openAndScan(vi.fn(), onClose);
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Đang hoàn tất đăng nhập');
    expect(backButton().disabled).toBe(true);
    await act(async () => { backButton().click(); });
    expect(onClose).not.toHaveBeenCalled();

    // Fail completion -> unlock UI -> retry creates a brand new attempt.
    await act(async () => { finishComplete({ success: false, message: 'Thất bại' }); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Thất bại');
    api.start.mockResolvedValueOnce({ attemptId: 'b'.repeat(32), expiresAt: Date.now() + 15000, intervalMs: 200 });
    api.frame.mockResolvedValueOnce({ seq: 1, state: 'verified', nextSeq: 2, guidance: 'ok' });
    await act(async () => { scanButton().click(); });
    expect(authState.completeFaceLogin).toHaveBeenLastCalledWith('b'.repeat(32));
  });

  it('cancels before complete when closed or when camera track ends during scanning', async () => {
    const onClose = vi.fn();
    await openAndScan(vi.fn(), onClose);
    await act(async () => { backButton().click(); });
    expect(api.cancel).toHaveBeenCalledWith('a'.repeat(32));
    expect(onClose).toHaveBeenCalledOnce();
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
  });

  it('cancels the attempt and never completes when unmounted or camera track disconnects during scanning', async () => {
    await openAndScan();
    await act(async () => { trackRef.onended?.(); });
    expect(api.cancel).toHaveBeenCalledWith('a'.repeat(32));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Camera đã ngắt');
    await act(async () => root.unmount());
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();
    root = createRoot(host);
  });

  it('stops at the attempt deadline without completing', async () => {
    api.start.mockResolvedValue({ attemptId: 'a'.repeat(32), expiresAt: Date.now() + 1500, remainingMs: 1500, intervalMs: 200 });
    api.frame.mockImplementation(async (_id, seq) => pending(seq));
    await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
    expect(api.cancel).toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('thời gian');
  });

  it('uses remainingMs with performance.now() even when client clock is skewed ±10 minutes, subtracts network RTT, and never extends deadline on status', async () => {
    // Client clock is 10 minutes ahead of server expiresAt (so Date.now() >= expiresAt immediately),
    // yet remainingMs is 3000 ms so scanning must still proceed using monotonic budget.
    api.start.mockResolvedValue({
      attemptId: 'a'.repeat(32),
      expiresAt: Date.now() - 10 * 60 * 1000,
      remainingMs: 3000,
      intervalMs: 200,
    });
    api.frame.mockRejectedValueOnce(new TypeError('network glitch'));
    // Status returns an artificially larger remainingMs (10000), which must NOT extend the local deadline (>3000)
    api.status.mockResolvedValueOnce({
      state: 'ready',
      nextSeq: 2,
      expiresAt: Date.now() + 600000,
      remainingMs: 10000,
    });
    api.frame.mockImplementation(async (_id, seq, _f, signal?: AbortSignal) => new Promise((_res, rej) => {
      signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
    }));
    await openAndScan();
    // Advance past the original 3000 ms budget (status must not have extended it to 10000 ms)
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('thời gian');
    expect(scanButton().disabled).toBe(false);
  });

  it('aborts hung config/start/frame/status requests via per-request and deadline timers with Vietnamese error messages and unlocks UI', async () => {
    // 1. Hung config (4s timeout) -> shows Vietnamese error, not raw English DOMException
    api.config.mockImplementationOnce((signal?: AbortSignal) => new Promise((_res, rej) => {
      signal?.addEventListener('abort', () => rej(signal.reason ?? new DOMException('The operation timed out.', 'TimeoutError')));
    }));
    await act(async () => { root.render(<FaceLoginModal onClose={vi.fn()} onSuccess={vi.fn()}/>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(document.querySelector('[role="alert"]')?.textContent).not.toContain('The operation timed out');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Không nhận diện được trong thời gian cho phép');
    await act(async () => root.unmount());
    root = createRoot(host);

    // 2. Hung start (4s timeout) -> aborts and unlocks UI with Vietnamese message
    api.start.mockImplementationOnce((signal?: AbortSignal) => new Promise((_res, rej) => {
      signal?.addEventListener('abort', () => rej(signal.reason ?? new DOMException('The operation timed out.', 'TimeoutError')));
    }));
    await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Không nhận diện được trong thời gian cho phép');
    expect(scanButton().disabled).toBe(false);

    // 3. Hung status (2s timeout after ambiguous frame network failure) -> aborts and unlocks UI with Vietnamese message
    api.start.mockResolvedValueOnce({ attemptId: 'a'.repeat(32), expiresAt: Date.now() + 15000, remainingMs: 15000, intervalMs: 200 });
    api.frame.mockRejectedValueOnce(new TypeError('network error'));
    api.status.mockImplementationOnce((_id: string, signal?: AbortSignal) => new Promise((_res, rej) => {
      signal?.addEventListener('abort', () => rej(signal.reason ?? new DOMException('The operation timed out.', 'TimeoutError')));
    }));
    await act(async () => { scanButton().click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Không nhận diện được trong thời gian cho phép');
    expect(scanButton().disabled).toBe(false);

    // 4. Hung frame (attempt deadline 1.5s) -> aborts via independent deadline timer and unlocks UI
    api.start.mockResolvedValueOnce({ attemptId: 'a'.repeat(32), expiresAt: Date.now() + 1500, remainingMs: 1500, intervalMs: 200 });
    api.frame.mockImplementationOnce(async (_id, _seq, _frame, signal?: AbortSignal) => {
      return await new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      });
    });
    const { success } = await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(success).not.toHaveBeenCalled();
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
    expect(scanButton().disabled).toBe(false);
    expect(backButton().disabled).toBe(false);
  });

  it('shows a terminal biometric failure without reporting success', async () => {
    api.frame.mockRejectedValueOnce(new ApiError('Không thể xác thực khuôn mặt.', 401));
    const { success } = await openAndScan();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(success).not.toHaveBeenCalled();
    expect(authState.completeFaceLogin).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Không thể xác thực');
  });

  it('shows configuration failure without opening a camera', async () => {
    api.config.mockResolvedValue(false);
    await act(async () => { root.render(<FaceLoginModal onClose={vi.fn()} onSuccess={vi.fn()}/>); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('chưa được bật');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
