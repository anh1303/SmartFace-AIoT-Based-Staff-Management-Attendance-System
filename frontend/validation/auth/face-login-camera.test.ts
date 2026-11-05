// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { captureJpeg, stopCamera } from '../../src/features/auth/lib/faceCamera';

describe('Login camera lifecycle and upload limits', () => {
  it('stops all camera tracks', () => {
    const first = vi.fn(), second = vi.fn();
    stopCamera({ getTracks: () => [{ stop: first }, { stop: second }] } as unknown as MediaStream);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(() => stopCamera(null)).not.toThrow();
  });
  it('does not capture video without actual dimensions', () => {
    const video = document.createElement('video');
    expect(() => captureJpeg(video)).toThrow();
  });
  it('resizes a camera frame and strips data URI before sending', () => {
    const video = document.createElement('video');
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 } });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,YWJj');
    expect(captureJpeg(video)).toBe('YWJj');
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 720, 405]);
    vi.restoreAllMocks();
  });
});
