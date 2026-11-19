// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/features/auth/context/AuthContext';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { ApiError } from '../../src/api/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockLoginApi = vi.fn();
const mockLogoutApi = vi.fn();
const mockMeApi = vi.fn().mockResolvedValue(null);
const mockFaceComplete = vi.fn();
const mockFaceStatus = vi.fn();

vi.mock('../../src/features/auth/api/authApi', () => ({
  loginApi: (...args: any[]) => mockLoginApi(...args),
  logoutApi: (...args: any[]) => mockLogoutApi(...args),
  meApi: () => mockMeApi(),
  DEFAULT_USERS: {},
}));

vi.mock('../../src/features/auth/api/faceLoginApi', () => ({
  faceLoginApi: {
    complete: (...args: any[]) => mockFaceComplete(...args),
    status: (...args: any[]) => mockFaceStatus(...args),
  },
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

  it('rejects password login with exact busy message while logout or face completion is in flight, and leaves idle password login intact', async () => {
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

    // 1. While face completion is in flight -> password login returns exact busy message and does not call loginApi
    let resolveComplete!: (v: any) => void;
    mockFaceComplete.mockImplementationOnce(() => new Promise(r => { resolveComplete = r; }));
    const pendingComplete = authHandle!.completeFaceLogin('a'.repeat(32));

    const busyDuringComplete = await authHandle!.login('testuser', 'secret');
    expect(busyDuringComplete).toEqual({
      success: false,
      message: 'Đang hoàn tất đăng nhập khuôn mặt. Vui lòng chờ rồi thử lại.',
    });
    expect(mockLoginApi).not.toHaveBeenCalled();

    await act(async () => {
      resolveComplete({ session: { username: 'emp1', role: 'employee' }, targetRole: 'employee' });
      await pendingComplete;
    });

    // 2. While logout is in flight -> password login returns exact logout busy message (and prioritized if both)
    let resolveLogout: () => void = () => {};
    mockLogoutApi.mockReturnValueOnce(new Promise<void>(r => { resolveLogout = r; }));
    const logoutAction = authHandle!.logout();

    const busyDuringLogout = await authHandle!.login('testuser', 'secret');
    expect(busyDuringLogout).toEqual({
      success: false,
      message: 'Đang đăng xuất. Vui lòng chờ rồi thử lại.',
    });
    expect(mockLoginApi).not.toHaveBeenCalled();

    // Calling completeFaceLogin during logout returns cancelled immediately without waiting for logout
    const completeDuringLogout = await authHandle!.completeFaceLogin('b'.repeat(32));
    expect(completeDuringLogout.success).toBe(false);
    expect(mockFaceComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogout();
      await logoutAction;
    });

    // 3. When idle -> password login succeeds normally
    mockLoginApi.mockResolvedValueOnce({
      session: { username: 'testuser', role: 'admin' },
      targetRole: 'admin',
    });
    let loginRes: any;
    await act(async () => {
      loginRes = await authHandle!.login('testuser', 'secret');
    });
    expect(loginRes).toEqual({ success: true, role: 'admin' });
    expect(mockLoginApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('one-way logout aborts in-flight complete, waits at most 1s if complete promise never settles, then sends logoutApi and blocks late accept/recovery', async () => {
    vi.useFakeTimers();
    try {
      const root = createRoot(host);
      let authHandle: ReturnType<typeof useAuth> | null = null;
      function TestComponent() { authHandle = useAuth(); return <div>One-way Logout Test</div>; }
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <AuthProvider><TestComponent /></AuthProvider>
          </QueryClientProvider>
        );
      });

      // Double complete for the same attempt reuses the same promise; different attempt returns conflict
      let capturedSignal: AbortSignal | undefined;
      let lateResolve!: (v: any) => void;
      mockFaceComplete.mockImplementationOnce((_id: string, signal?: AbortSignal) => {
        capturedSignal = signal;
        // Promise intentionally ignores abort and never settles for > 1s
        return new Promise(r => { lateResolve = r; });
      });
      mockLogoutApi.mockResolvedValue(undefined);

      const p1 = authHandle!.completeFaceLogin('a'.repeat(32));
      const p2 = authHandle!.completeFaceLogin('a'.repeat(32));
      expect(mockFaceComplete).toHaveBeenCalledTimes(1);
      const conflict = await authHandle!.completeFaceLogin('b'.repeat(32));
      expect(conflict.success).toBe(false);

      // Trigger logout while complete is stuck
      const logoutPromise = authHandle!.logout();
      expect(capturedSignal?.aborted).toBe(true);
      // Before 1s settle cap expires, logoutApi has not been sent because p1 hasn't settled
      expect(mockLogoutApi).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      await act(async () => { await logoutPromise; });
      expect(mockLogoutApi).toHaveBeenCalledTimes(1);

      // Even if late complete promise resolves later, session is NOT accepted and no recovery retry occurs
      await act(async () => {
        lateResolve({ session: { username: 'late-user', role: 'employee' }, targetRole: 'employee' });
        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1.success).toBe(false);
        expect(r2.success).toBe(false);
      });
      expect(authHandle!.currentUser).toBeNull();
      expect(mockFaceStatus).not.toHaveBeenCalled();

      // Complete timeout (10s budget) unlocks and returns indeterminate message
      mockFaceComplete.mockImplementationOnce((_id: string, signal?: AbortSignal) => new Promise((_res, rej) => {
        signal?.addEventListener('abort', () => rej(new DOMException('Timeout', 'AbortError')));
      }));
      mockFaceStatus.mockImplementation((_id: string, signal?: AbortSignal) => new Promise((_res, rej) => {
        signal?.addEventListener('abort', () => rej(new DOMException('Timeout', 'AbortError')));
      }));
      let timedOutResult: any;
      const pTimeout = authHandle!.completeFaceLogin('c'.repeat(32)).then(r => { timedOutResult = r; });
      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      await act(async () => { await pTimeout; });
      expect(timedOutResult).toEqual({
        success: false,
        message: 'Chưa xác định được kết quả đăng nhập. Vui lòng kiểm tra kết nối hoặc tải lại trang.',
      });

      // Status polling spacing: never fires a second status poll if remaining budget is < 250 ms
      mockFaceStatus.mockClear();
      mockFaceComplete.mockImplementationOnce(() => new Promise((_res, rej) => {
        setTimeout(() => rej(new TypeError('network lost at 9.85s')), 9850);
      }));
      mockFaceStatus.mockResolvedValue({
        state: 'completing',
        nextSeq: 2,
        expiresAt: Date.now() + 5000,
        remainingMs: 5000,
      });
      let sliceResult: any;
      const pSlice = authHandle!.completeFaceLogin('d'.repeat(32)).then(r => { sliceResult = r; });
      await act(async () => { await vi.advanceTimersByTimeAsync(10_100); });
      await act(async () => { await pSlice; });
      // Only 1 status poll could run at 9.85s because remaining budget (150ms) < 250ms minimum spacing
      expect(mockFaceStatus).toHaveBeenCalledTimes(1);
      expect(sliceResult.success).toBe(false);

      await act(async () => { root.unmount(); });
    } finally {
      vi.useRealTimers();
    }
  });

  it('logout_clears_cookie_already_set_by_complete_headers: aborts complete whose headers arrived before body, sends logout after settle, and neither accepts session nor retries recovery', async () => {
    const root = createRoot(host);
    let authHandle: ReturnType<typeof useAuth> | null = null;
    function TestComponent() { authHandle = useAuth(); return <div>Headers Before Body Test</div>; }
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider><TestComponent /></AuthProvider>
        </QueryClientProvider>
      );
    });

    const callOrder: string[] = [];
    mockFaceComplete.mockImplementationOnce((_id: string, signal?: AbortSignal) => {
      callOrder.push('complete:headers_received');
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          callOrder.push('complete:body_aborted');
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    mockLogoutApi.mockImplementationOnce(async () => {
      callOrder.push('logout:sent');
    });

    const completePromise = authHandle!.completeFaceLogin('a'.repeat(32));
    const logoutPromise = authHandle!.logout();
    const [completeRes] = await Promise.all([completePromise, logoutPromise]);

    expect(callOrder).toEqual(['complete:headers_received', 'complete:body_aborted', 'logout:sent']);
    expect(completeRes.success).toBe(false);
    expect(authHandle!.currentUser).toBeNull();
    expect(mockFaceStatus).not.toHaveBeenCalled();
    expect(mockFaceComplete).toHaveBeenCalledTimes(1);

    await act(async () => { root.unmount(); });
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

  it('reconciles a lost face-login completion response via bounded attempt status and cached complete retry without accepting another user from /me', async () => {
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

    // Existing session belongs to user B (/me returns user B), while attempt belongs to user A:
    // Recovery MUST retry complete(attemptId) to receive user A's cached session/token, NEVER accept user B from /me.
    mockMeApi.mockResolvedValue({ username: 'user-b', employee_id: 'NV-B', role: 'employee' });
    mockFaceComplete
      .mockRejectedValueOnce(new TypeError('headers delivered, body lost'))
      .mockResolvedValueOnce({
        session: { username: 'user-a', employee_id: 'NV-A', role: 'employee' },
        targetRole: 'employee',
      });
    mockFaceStatus.mockResolvedValueOnce({
      state: 'completed',
      nextSeq: 4,
      expiresAt: Date.now() + 5000,
      remainingMs: 5000,
    });

    let res1: any;
    await act(async () => { res1 = await authHandle!.completeFaceLogin('a'.repeat(32)); });
    expect(res1).toEqual({ success: true, role: 'employee' });
    expect(authHandle!.currentUser?.username).toBe('user-a');
    expect(mockFaceComplete).toHaveBeenCalledTimes(2);

    // Status verified after ambiguous 503 failure -> retries complete once within budget.
    mockFaceComplete
      .mockRejectedValueOnce(new ApiError('Bad Gateway', 503))
      .mockResolvedValueOnce({
        session: { username: 'user-a2', employee_id: 'NV-A2', role: 'employee' },
        targetRole: 'employee',
      });
    mockFaceStatus.mockResolvedValueOnce({
      state: 'verified',
      nextSeq: 4,
      expiresAt: Date.now() + 5000,
      remainingMs: 5000,
    });
    let res2: any;
    await act(async () => { res2 = await authHandle!.completeFaceLogin('b'.repeat(32)); });
    expect(res2).toEqual({ success: true, role: 'employee' });
    expect(authHandle!.currentUser?.username).toBe('user-a2');

    // Definite 401/403/404/410 from complete -> does not poll status or retry complete.
    mockFaceStatus.mockClear();
    mockFaceComplete.mockClear();
    mockFaceComplete.mockRejectedValueOnce(new ApiError('Lượt nhận diện đã kết thúc.', 410));
    let res3: any;
    await act(async () => { res3 = await authHandle!.completeFaceLogin('c'.repeat(32)); });
    expect(res3.success).toBe(false);
    expect(mockFaceStatus).not.toHaveBeenCalled();
    expect(mockFaceComplete).toHaveBeenCalledTimes(1);

    await act(async () => { root.unmount(); });
  });
});
