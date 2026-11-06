import { describe, expect, it } from 'vitest';
import { payloadHash, publicOperation, summarizeItems } from '../../src/modules/operations/operation.contract.js';
import { decryptPayload, encryptPayload } from '../../src/modules/operations/operation.crypto.js';

describe('background operation contracts', () => {
  it('treats reordered object fields as the same command, but preserves ordered assignments', () => {
    expect(payloadHash({ b: 2, a: 1 })).toBe(payloadHash({ a: 1, b: 2 }));
    expect(payloadHash({ assignments: [1, 2] })).not.toBe(payloadHash({ assignments: [2, 1] }));
  });
  it('reports partial completion and exact counts instead of claiming all items saved', () => {
    expect(summarizeItems([{ status: 'succeeded' }, { status: 'failed' }, { status: 'skipped' }])).toEqual({ status: 'partially_succeeded', total: 3, completed: 3, succeeded: 1, failed: 1, skipped: 1 });
    expect(summarizeItems([]).status).toBe('succeeded');
    expect(summarizeItems([{ status: 'failed' }]).status).toBe('failed');
  });
  it('never exposes encrypted input, actor IDs or credentials in operation responses', () => {
    const result = publicOperation({ id: 'j1', type: 'email', label: 'Gửi email', status: 'queued', revision: 1, total: 1, completed: 0, succeeded: 0, failed: 0, skipped: 0, created_at: new Date('2026-11-06'), updated_at: new Date('2026-11-06'), payload: { password: 'secret' }, owner_id: 'private', input_hash: 'secret', result: { temporary_password: 'secret' } } as any);
    expect(JSON.stringify(result)).not.toContain('secret'); expect(result).toMatchObject({ jobId: 'j1', status: 'queued' });
  });
  it('encrypts staged data, detects tampering and rejects a wrong key', () => {
    const encrypted = encryptPayload({ images: ['private-face'], password: 'secret' }, 'a'.repeat(32));
    expect(encrypted.toString()).not.toContain('private-face');
    expect(decryptPayload(encrypted, 'a'.repeat(32))).toEqual({ images: ['private-face'], password: 'secret' });
    expect(() => decryptPayload(encrypted, 'b'.repeat(32))).toThrow();
    encrypted[20] ^= 1; expect(() => decryptPayload(encrypted, 'a'.repeat(32))).toThrow();
  });
});
