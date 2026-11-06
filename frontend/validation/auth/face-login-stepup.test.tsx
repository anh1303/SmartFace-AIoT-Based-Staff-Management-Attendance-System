// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { PasswordReauthentication } from '../../src/features/auth/components/PasswordReauthentication';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { passwordSession } = vi.hoisted(() => ({ passwordSession: vi.fn() }));
vi.mock('../../src/features/auth/api/faceLoginApi', () => ({ faceLoginApi: { passwordSession } }));

describe('Sensitive action reauthentication', () => {
  it('only resumes a blocked action after password verification succeeds', async () => {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host), complete = vi.fn();
    passwordSession.mockRejectedValueOnce(new Error('Mật khẩu không đúng.')).mockResolvedValueOnce(undefined);
    await act(async () => root.render(<PasswordReauthentication onComplete={complete}/>));
    const input = host.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'secret');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(complete).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mật khẩu không đúng');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(complete).toHaveBeenCalledOnce();
    expect(input.value).toBe('');
    await act(async () => root.unmount()); host.remove();
  });
});
