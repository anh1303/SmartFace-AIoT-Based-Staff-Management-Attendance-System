import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAttendanceApi } from '../../src/features/attendances/api/attendanceApi';
import * as client from '../../src/api/client';

describe('Attendance API 50k pagination boundary & truncation alert (P2-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops at 50,000 records, marks result with isTruncated = true, and logs a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTruncatedMock = vi.fn();

    // Generate batches of 5000 records
    const makeBatch = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `att-${i}`,
        employee_id: 'EMP001',
        type: 'CHECK_IN',
        timestamp: '2026-10-25T08:00:00Z',
        status: 'VALID',
      }));

    let callCount = 0;
    vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      callCount++;
      return {
        success: true,
        data: makeBatch(5000),
      };
    });

    const records = await fetchAttendanceApi({
      limit: 5000,
      onTruncated: onTruncatedMock,
    });

    // 10 calls * 5000 = 50,000 records
    expect(callCount).toBe(10);
    expect(records.length).toBe(50000);
    expect((records as any).isTruncated).toBe(true);
    expect(onTruncatedMock).toHaveBeenCalledWith(50000);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('50,000')
    );
  });

  it('allows fetchAllPages: true to bypass the 50,000 limit when explicitly requested', async () => {
    const makeBatch = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `att-${i}`,
        employee_id: 'EMP001',
        type: 'CHECK_IN',
        timestamp: '2026-10-25T08:00:00Z',
        status: 'VALID',
      }));

    let callCount = 0;
    vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      callCount++;
      // Return 11 pages of 5000 = 55,000 records, then on 12th return fewer to stop
      if (callCount <= 11) {
        return { success: true, data: makeBatch(5000) };
      }
      return { success: true, data: makeBatch(100) };
    });

    const records = await fetchAttendanceApi({
      limit: 5000,
      fetchAllPages: true,
    });

    expect(callCount).toBe(12);
    expect(records.length).toBe(55100);
    expect((records as any).isTruncated).toBeFalsy();
  });

  it('correctly passes startDate and endDate to query string parameters', async () => {
    let capturedUrl = '';
    vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { success: true, data: [] };
    });

    await fetchAttendanceApi({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });

    expect(capturedUrl).toContain('startDate=2026-10-01');
    expect(capturedUrl).toContain('endDate=2026-10-31');
  });

  it('reports an unsuccessful page instead of silently returning partial data', async () => {
    vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({ success: true, data: [{ id: 'first' }] } as any)
      .mockResolvedValueOnce({ success: false, message: 'unavailable' } as any);
    await expect(fetchAttendanceApi({ limit: 1, fetchAllPages: true })).rejects.toThrow();
  });
});
