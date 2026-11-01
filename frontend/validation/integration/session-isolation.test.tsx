// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { AccountProfilePage } from '../../src/pages/account/AccountProfilePage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockProfileGet = vi.fn();
const mockProfileUpdate = vi.fn();
const mockChangePassword = vi.fn();
const mockMeApi = vi.fn().mockResolvedValue(null);

vi.mock('@/features/auth', () => ({
  profileApi: {
    get: () => mockProfileGet(),
    update: (data: any) => mockProfileUpdate(data),
    changePassword: (...args: any[]) => mockChangePassword(...args),
  },
  meApi: () => mockMeApi(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  DEFAULT_USERS: {},
}));

vi.mock('../../src/context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../src/components/common/PageHeaderBanner', () => ({
  PageHeaderBanner: ({ title }: any) => <h1>{title}</h1>,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('Session Isolation and Profile Mutation Bleed Prevention (P1-2)', () => {
  it('prevents delayed profile update of user A from overwriting cache and session of user B', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    let authHandle: any = null;
    function TestConsumer() {
      authHandle = useAuth();
      return <AccountProfilePage />;
    }

    // Delayed promise controllers for User A's update
    let resolveUpdateA: (val: any) => void = () => {};
    const pendingUpdatePromiseA = new Promise((resolve) => {
      resolveUpdateA = resolve;
    });

    mockProfileGet.mockResolvedValue({
      display_name: 'User A Original',
      contact_email: 'a@smartface.local',
      phone: '0123456789',
      avatar: null,
      account: {
        username: 'user_a',
        role: 'EMPLOYEE',
        employee_code: 'EMP_A',
        official_name: 'User A',
        department: 'Engineering',
        position: 'Staff',
      },
    });

    mockProfileUpdate.mockImplementation(() => pendingUpdatePromiseA);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              <TestConsumer />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );
    });

    // 1. Set session for User A
    await act(async () => {
      authHandle.setCurrentUserSession({
        username: 'user_a',
        role: 'employee',
        employee_id: 'EMP_A',
        full_name: 'User A',
        department: 'Engineering',
        position: 'Staff',
      });
    });

    // Wait for query to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Trigger save for User A
    const saveButton = document.querySelector('button.sf-button.primary') as HTMLButtonElement;
    expect(saveButton).toBeTruthy();

    await act(async () => {
      const form = document.querySelector('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Mutation is pending now for user A
    expect(mockProfileUpdate).toHaveBeenCalled();

    // 2. User A logs out and User B logs in before response returns
    await act(async () => {
      authHandle.setCurrentUserSession({
        username: 'user_b',
        role: 'manager',
        employee_id: 'EMP_B',
        full_name: 'User B',
        department: 'Operations',
        position: 'Manager',
      });
    });

    // Pre-populate User B's cache
    queryClient.setQueryData(['accountProfile', 'user_b'], {
      display_name: 'User B Display',
      contact_email: 'b@smartface.local',
      account: { username: 'user_b' },
    });

    // 3. User A's delayed response finally arrives
    await act(async () => {
      resolveUpdateA({
        display_name: 'User A Hijack Name',
        contact_email: 'hijack@smartface.local',
        account: { username: 'user_a' },
      });
      // Also mock meApi if it were called
      mockMeApi.mockResolvedValue({
        username: 'user_a',
        role: 'employee',
        employee_id: 'EMP_A',
        full_name: 'User A Hijack',
      });
    });

    // 4. Assert User B's cache and session were NOT overwritten
    const bCache = queryClient.getQueryData(['accountProfile', 'user_b']) as any;
    expect(bCache.display_name).toBe('User B Display');
    expect(bCache.contact_email).toBe('b@smartface.local');

    // Current user session is still User B
    expect(authHandle.currentUser.username).toBe('user_b');
    expect(authHandle.currentUser.employee_id).toBe('EMP_B');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('preserves User B session when User A delayed changePassword response returns after B logs in', async () => {
    let mockChangePasswordResolver: () => void = () => {};
    const pendingChangePassword = new Promise<void>((resolve) => {
      mockChangePasswordResolver = resolve;
    });

    mockChangePassword.mockImplementation(() => pendingChangePassword);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    let authHandle: any = null;
    function TestConsumer() {
      authHandle = useAuth();
      return <AccountProfilePage />;
    }

    mockProfileGet.mockResolvedValue({
      display_name: 'User A',
      contact_email: 'a@smartface.local',
      phone: '0123456789',
      avatar: null,
      account: {
        username: 'user_a',
        role: 'EMPLOYEE',
        employee_code: 'EMP_A',
        official_name: 'User A',
        department: 'Engineering',
        position: 'Staff',
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              <TestConsumer />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );
    });

    // 1. User A is logged in
    await act(async () => {
      authHandle.setCurrentUserSession({
        username: 'user_a',
        role: 'employee',
        employee_id: 'EMP_A',
        full_name: 'User A',
        department: 'Engineering',
        position: 'Staff',
      });
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // 2. User A fills password form and submits
    const passwordInputs = document.querySelectorAll('#security input[type="password"]') as NodeListOf<HTMLInputElement>;
    expect(passwordInputs.length).toBeGreaterThanOrEqual(3);

    const setInputValue = (input: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    await act(async () => {
      setInputValue(passwordInputs[0], 'OldPassword123');
      setInputValue(passwordInputs[1], 'NewPassword123');
      setInputValue(passwordInputs[2], 'NewPassword123');
    });

    const passwordForm = document.querySelector('#security form')!;
    await act(async () => {
      passwordForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockChangePassword).toHaveBeenCalled();

    // 3. User A logs out via sidebar (logout called), then User B logs in
    await act(async () => {
      authHandle.logout();
    });

    await act(async () => {
      authHandle.setCurrentUserSession({
        username: 'user_b',
        role: 'manager',
        employee_id: 'EMP_B',
        full_name: 'User B',
        department: 'Operations',
        position: 'Manager',
      });
    });

    expect(authHandle.currentUser?.username).toBe('user_b');

    // 4. Now User A's changePassword resolves
    await act(async () => {
      mockChangePasswordResolver();
      await new Promise(r => setTimeout(r, 50));
    });

    // User B MUST remain logged in!
    expect(authHandle.currentUser).not.toBeNull();
    expect(authHandle.currentUser?.username).toBe('user_b');
    expect(authHandle.currentUser?.employee_id).toBe('EMP_B');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('allows profile save after real login adapter and cookie restoration without guard blocking response', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    let authHandle: any = null;
    function TestConsumer() {
      authHandle = useAuth();
      return <AccountProfilePage />;
    }

    // Real adapter behavior simulation
    const realBackendUser = {
      id: 'uuid-123',
      username: 'johndoe',
      email: 'john@smartface.local',
      full_name: 'John Doe',
      role_name: 'EMPLOYEE',
      employee_id: 'EMP-042',
      position: 'Engineer',
      department: 'Tech',
    };

    // User session parsed by authApi adapter:
    const adaptedSession = {
      username: realBackendUser.username,
      employee_id: realBackendUser.employee_id,
      full_name: realBackendUser.full_name,
      email: realBackendUser.email,
      role: 'employee' as const,
      role_name: realBackendUser.role_name,
      is_manager: false,
      position: realBackendUser.position,
      positionId: null,
      department: realBackendUser.department,
      departmentId: null,
      avatar: '',
    };

    mockProfileGet.mockResolvedValue({
      display_name: 'John Doe',
      contact_email: 'john@smartface.local',
      phone: '0901234567',
      avatar: null,
      account: {
        username: 'johndoe',
        role: 'EMPLOYEE',
        employee_code: 'EMP-042',
        official_name: 'John Doe',
        department: 'Tech',
        position: 'Engineer',
      },
    });

    mockProfileUpdate.mockResolvedValue({
      display_name: 'John Doe Updated',
      contact_email: 'john.new@smartface.local',
      phone: '0901234567',
      avatar: 'data:image/jpeg;base64,mockavatar',
      account: {
        username: 'johndoe',
        role: 'EMPLOYEE',
        employee_code: 'EMP-042',
        official_name: 'John Doe',
        department: 'Tech',
        position: 'Engineer',
      },
    });

    mockMeApi.mockResolvedValue({
      ...adaptedSession,
      full_name: 'John Doe Updated',
      avatar: 'data:image/jpeg;base64,mockavatar',
    });

    // Mount component
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              <TestConsumer />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );
    });

    // Wait for mount initialization (meApi cookie restore)
    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    // Set user session if not already restored
    await act(async () => {
      authHandle.setCurrentUserSession(adaptedSession);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    // Fill new name and save
    const nameInput = document.querySelector('input[autoComplete="name"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(nameInput, 'John Doe Updated');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const form = document.querySelector('section#personal form')!;
    expect(form).toBeTruthy();

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 80));
    });

    expect(mockProfileUpdate).toHaveBeenCalled();

    // Check that success feedback is displayed
    const successFeedback = document.querySelector('div[role="status"]');
    expect(successFeedback?.textContent).toContain('Đã lưu thông tin cá nhân');

    // Query cache must be updated
    const cached = queryClient.getQueryData(['accountProfile', 'johndoe']) as any;
    expect(cached?.display_name).toBe('John Doe Updated');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});

