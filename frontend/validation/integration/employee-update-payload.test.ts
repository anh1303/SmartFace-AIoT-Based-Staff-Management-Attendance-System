import { expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/client', () => ({ apiFetch: request }));
vi.mock('../../src/features/operations', () => ({
  commandKey: vi.fn(), definitiveFailure: () => true, UncertainWriteError: class extends Error {},
}));
import { updateEmployeeApi } from '../../src/features/employees/api/employeeApi';

it.each([false, true])('updates profile without submitting the device-owned fingerprint flag (%s)', async fingerprint => {
  request.mockReset();
  request.mockResolvedValue({ data: {
    id: 'employee-17', employee_code: 'NV-017', full_name: 'Updated name', status: 'ACTIVE',
    fingerprint_enrolled: fingerprint,
  } });
  const version = '2026-11-17T12:00:00.000Z';
  const result = await updateEmployeeApi('employee-17', {
    full_name: 'Updated name', department: 'CSKH', position: 'Support', email: 'employee@example.com',
    phone: '0976222443', hourly_rate: 95000, fingerprint_enrolled: fingerprint, updated_at: version,
  });
  expect(request).toHaveBeenCalledTimes(1);
  const [url, options] = request.mock.calls[0];
  expect(url).toBe('/api/employees/employee-17');
  expect(options.method).toBe('PUT');
  expect(JSON.parse(options.body)).toEqual({
    full_name: 'Updated name', department: 'CSKH', position: 'Support', email: 'employee@example.com',
    phone: '0976222443', hourly_rate: 95000, expectedVersion: version,
  });
  expect(result.fingerprint_enrolled).toBe(fingerprint);
});
