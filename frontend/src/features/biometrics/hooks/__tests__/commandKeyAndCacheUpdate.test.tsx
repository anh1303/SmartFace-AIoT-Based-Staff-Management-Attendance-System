// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  deleteEmployeeApi: vi.fn(),
  fetchEmployeesApi: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../../api/client', () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  apiFetch: apiMocks.apiFetch,
}));

vi.mock('@/features/auth', () => ({
  getActiveSessionId: () => 1,
  getActiveUsername: () => 'admin',
}));

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: apiMocks.showToast }),
}));

vi.mock('../../../employees/api/employeeApi', () => ({
  fetchEmployeesApi: apiMocks.fetchEmployeesApi,
  createEmployeeApi: vi.fn(),
  updateEmployeeApi: vi.fn(),
  deleteEmployeeApi: apiMocks.deleteEmployeeApi,
}));

import { submitAndWait } from '../../../operations/api/commandApi';
import { useEmployees, EMPLOYEES_QUERY_KEY } from '../../../employees/hooks/useEmployees';
import type { Employee } from '../../../employees/types';

describe('Task 8A - Single SHA-256 digest & immediate cache updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('submitAndWait computes SHA-256 commandKey exactly once', async () => {
    const digestSpy = vi.spyOn(crypto.subtle, 'digest');
    apiMocks.apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') {
        return {
          success: true,
          data: { jobId: 'job-123', type: 'biometric.enroll', status: 'succeeded', progress: { succeeded: 1, failed: 0, skipped: 0 } },
        };
      }
      return {
        success: true,
        data: { jobId: 'job-123', type: 'biometric.enroll', status: 'succeeded', progress: { succeeded: 1, failed: 0, skipped: 0 } },
      };
    });

    const result = await submitAndWait('/api/biometrics/enroll-jobs', {
      employeeId: 'EMP-001',
      images: ['data:image/jpeg;base64,AAAA'],
    });

    expect(result.jobId).toBe('job-123');
    expect(digestSpy).toHaveBeenCalledTimes(1);
    digestSpy.mockRestore();
  });

  it('deleteEmployee immediately removes employee from cache without triggering full list refetch', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const emp1 = {
      id: 'uuid-1',
      employee_id: 'EMP-001',
      full_name: 'Alice',
      email: 'a@test.local',
      department: 'Eng',
      position: 'Dev',
      status: 'ACTIVE',
    } as Employee;
    const emp2 = {
      id: 'uuid-2',
      employee_id: 'EMP-002',
      full_name: 'Bob',
      email: 'b@test.local',
      department: 'Eng',
      position: 'Dev',
      status: 'ACTIVE',
    } as Employee;

    queryClient.setQueryData(EMPLOYEES_QUERY_KEY, [emp1, emp2]);
    apiMocks.fetchEmployeesApi.mockResolvedValue([emp1, emp2]);
    apiMocks.deleteEmployeeApi.mockResolvedValue({ success: true });

    let hookRef: ReturnType<typeof useEmployees> | null = null;
    function Harness() {
      hookRef = useEmployees(false);
      return <div>{hookRef.employees.length}</div>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await hookRef!.deleteEmployee('EMP-001');
    });

    const cached = queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY);
    expect(cached?.map((e) => e.employee_id)).toEqual(['EMP-002']);
    expect(apiMocks.fetchEmployeesApi).toHaveBeenCalledTimes(0);
  });
});
