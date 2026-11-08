// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const request = vi.hoisted(() => vi.fn());
const actor = vi.hoisted(() => ({ username: 'manager-a' }));
vi.mock('../../src/api/client', () => ({ apiFetch: request, ApiError: class extends Error {} }));
vi.mock('../../src/context/AuthContext', () => ({ getActiveSessionId: () => 1, getActiveUsername: () => actor.username }));
import { commandKey, submitAndWait, waitForOperation, OperationFailedError } from '../../src/features/operations/commandApi';
const job = { jobId: 'job', type: 'shifts.batch', label: 'Lịch', status: 'running' as const, revision: 1, progress: { total: 2, completed: 0, succeeded: 0, failed: 0, skipped: 0 } };
beforeEach(() => { request.mockReset(); sessionStorage.clear(); actor.username = 'manager-a'; vi.stubGlobal('crypto', webcrypto); });
it('isolates unknown operation IDs across accounts while keeping retries stable for the original owner', async () => {
  const a = await commandKey('/api/shifts/batch', { assignments: [] });
  sessionStorage.setItem(`${a.storageKey}:job`, 'old-owner-job');
  expect((await commandKey('/api/shifts/batch', { assignments: [] })).key).toBe(a.key);
  actor.username = 'manager-b';
  const b = await commandKey('/api/shifts/batch', { assignments: [] });
  expect(b.storageKey).not.toBe(a.storageKey);
  request.mockResolvedValueOnce({ data: { ...job, jobId: 'new-owner-job', status: 'succeeded' } });
  await submitAndWait('/api/shifts/batch', { assignments: [] });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/api/shifts/batch', expect.objectContaining({ method: 'POST' }));
});
it('does not treat an accepted request as a saved result', async () => {
  request.mockResolvedValueOnce({ data: { ...job, status: 'succeeded' } });
  const result = await waitForOperation(job);
  expect(request).toHaveBeenCalledWith('/api/operations/job');
  expect(result.status).toBe('succeeded');
});
it('preserves the operation and item errors when a batch only partly succeeds', async () => {
  const partial = { ...job, status: 'partially_succeeded', progress: { ...job.progress, completed: 2, succeeded: 1, failed: 1 }, items: [{ item_key: 'NV1:2026-11-09', status: 'failed', error: 'Lịch đã thay đổi' }] };
  request.mockResolvedValueOnce({ data: partial });
  await expect(waitForOperation(job)).rejects.toMatchObject({ operation: partial, message: expect.stringContaining('Lịch đã thay đổi') });
  await expect(waitForOperation({ ...job, status: 'failed' })).rejects.toBeInstanceOf(OperationFailedError);
});
