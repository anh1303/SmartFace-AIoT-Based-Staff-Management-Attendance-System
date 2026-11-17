// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { Sidebar } from '../../src/components/layout/Sidebar';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockLoginApi = vi.fn();
const mockLogoutApi = vi.fn();
const mockMeApi = vi.fn().mockResolvedValue(null);
const mockFaceComplete = vi.fn();
const mockFaceStatus = vi.fn();

vi.mock('@/features/auth', () => ({
  loginApi: (...args: any[]) => mockLoginApi(...args),
  logoutApi: () => mockLogoutApi(),
  meApi: () => mockMeApi(),
  faceLoginApi: {
    complete: (...args: any[]) => mockFaceComplete(...args),
    status: (...args: any[]) => mockFaceStatus(...args),
  },
  DEFAULT_USERS: {},
}));

vi.mock('../../src/context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../src/context/NotificationContext', () => ({
  useOptionalNotifications: () => ({ clearAll: vi.fn() }),
}));

describe('AuthContext and Sidebar Logout/Login Race Prevention (P2-5)', () => {
  let queryClient: QueryClient;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('awaits pending logout before initiating loginApi so new session cookie is not overwritten', async () => {
    const root = createRoot(host);
    let authHandle: ReturnType<typeof useAuth> | null = null;

    function TestComponent() {
      authHandle = useAuth();
      return <div>Auth Test</div>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </QueryClientProvider>
      );
    });

    expect(authHandle).not.toBeNull();

    // Setup delayed logoutApi
    let resolveLogout: () => void = () => {};
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });
    mockLogoutApi.mockReturnValue(logoutPromise);

    let loginApiCalled = false;
    mockLoginApi.mockImplementation(async () => {
      loginApiCalled = true;
      return {
        session: { username: 'testuser', role: 'admin' },
        targetRole: 'admin',
      };
    });

    // Start logout
    let logoutFinished = false;
    const logoutAction = authHandle!.logout().then(() => {
      logoutFinished = true;
    });

    // Immediately start login while logout is in flight
    const loginAction = authHandle!.login('testuser', 'secret');

    // Yield microtasks
    await new Promise((r) => setTimeout(r, 10));

    // At this moment, logoutApi is pending, loginApi MUST NOT have been called yet
    expect(mockLogoutApi).toHaveBeenCalledTimes(1);
    expect(loginApiCalled).toBe(false);
    expect(logoutFinished).toBe(false);

    // Now resolve logoutApi
    resolveLogout();
    await logoutAction;
    expect(logoutFinished).toBe(true);

    // Yield microtasks to let login proceed
    await loginAction;

    // Now loginApi must have been called
    expect(loginApiCalled).toBe(true);
    expect(mockLoginApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('Sidebar awaits logout and prevents double submission during logout', async () => {
    const root = createRoot(host);

    let resolveLogout: () => void = () => {};
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });
    mockLogoutApi.mockReturnValue(logoutPromise);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Sidebar isOpen={true} onClose={() => {}} />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );
    });

    const logoutBtn = host.querySelector('button[aria-label="Đăng xuất"]') as HTMLButtonElement;
    expect(logoutBtn).not.toBeNull();

    // Click logout once
    act(() => {
      logoutBtn.click();
    });

    // Button should be disabled while logout is in flight
    expect(logoutBtn.disabled).toBe(true);
    expect(mockLogoutApi).toHaveBeenCalledTimes(1);

    // Clicking again should not trigger another logout
    act(() => {
      logoutBtn.click();
    });
    expect(mockLogoutApi).toHaveBeenCalledTimes(1);

    // Resolve logout
    await act(async () => {
      resolveLogout();
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('reconciles a lost face-login completion response via attempt status and /me or cached retry', async () => {
    const root = createRoot(host);
    let authHandle: ReturnType<typeof useAuth> | null = null;
    function TestComponent() { authHandle = useAuth(); return <div>Face Complete Test</div>; }
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider><TestComponent /></AuthProvider>
        </QueryClientProvider>
      );
    });

    // Case 1: complete response lost, but cookie was delivered (/me returns session).
    mockFaceComplete.mockRejectedValueOnce(new TypeError('network lost'));
    mockFaceStatus.mockResolvedValueOnce({ state: 'completed', nextSeq: 4, expiresAt: Date.now() + 5000 });
    mockMeApi.mockResolvedValueOnce({ username: 'emp1', role: 'employee' });
    let res1: any;
    await act(async () => { res1 = await authHandle!.completeFaceLogin('a'.repeat(32)); });
    expect(res1).toEqual({ success: true, role: 'employee' });
    expect(mockFaceComplete).toHaveBeenCalledTimes(1);

    // Case 2: complete response lost and cookie not yet delivered (/me null -> retries complete once).
    mockFaceComplete
      .mockRejectedValueOnce(new TypeError('network lost'))
      .mockResolvedValueOnce({ session: { username: 'emp2', role: 'employee' }, targetRole: 'employee' });
    mockFaceStatus.mockResolvedValueOnce({ state: 'completed', nextSeq: 4, expiresAt: Date.now() + 5000 });
    mockMeApi.mockResolvedValueOnce(null);
    let res2: any;
    await act(async () => { res2 = await authHandle!.completeFaceLogin('b'.repeat(32)); });
    expect(res2).toEqual({ success: true, role: 'employee' });
    expect(mockFaceComplete).toHaveBeenCalledTimes(3);

    await act(async () => { root.unmount(); });
  });
});
