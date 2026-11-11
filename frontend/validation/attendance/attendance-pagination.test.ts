import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAttendanceApi } from '../../src/features/attendances/api/attendanceApi';
import * as client from '../../src/api/client';

describe('Bounded attendance pages and explicit full-range reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads one bounded page by default and signals that more records may exist', async () => {
    const call = vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      const parsed = new URL(url, 'http://local');
      const limit = Number(parsed.searchParams.get('limit'));
      return { success: true, data: Array.from({ length: limit }, (_, id) => ({ id })) } as any;
    });
    const records = await fetchAttendanceApi();
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0]).toContain('limit=50');
    expect(records).toHaveLength(50);
    expect(records.isTruncated).toBe(true);
  });

  it('caps ordinary requested pages at 200 rows instead of reloading thousands', async () => {
    const call = vi.spyOn(client, 'apiFetch').mockResolvedValue({ success: true, data: [] } as any);
    await fetchAttendanceApi({ limit: 5000, page: 2 });
    expect(call.mock.calls[0][0]).toContain('limit=200');
    expect(call.mock.calls[0][0]).toContain('page=2');
    expect(call).toHaveBeenCalledTimes(1);
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
      expect(new URL(url, 'http://local').searchParams.get('fetchAllPages')).toBe('true');
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

  it('returns all 10,001 rows for an explicitly requested range', async () => {
    const call = vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      const q = new URL(url, 'http://local').searchParams;
      const page = Number(q.get('page'));
      const limit = Number(q.get('limit'));
      const offset = (page - 1) * limit;
      return { success: true, data: Array.from({ length: Math.min(limit, Math.max(0, 10001 - offset)) }, (_, i) => ({ id: offset + i })) } as any;
    });
    const records = await fetchAttendanceApi({ startDate: '2026-11-01', endDate: '2026-11-08', fetchAllPages: true });
    expect(records).toHaveLength(10001);
    expect(new Set(records.map((r: any) => r.id)).size).toBe(10001);
    expect(call).toHaveBeenCalledTimes(3);
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
