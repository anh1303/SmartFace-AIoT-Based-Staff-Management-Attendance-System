import { expect, it } from 'vitest'
import { aggregationInputFingerprint } from '../../src/modules/attendance/attendance.aggregation-input.js'

it('reuses unchanged day inputs but invalidates logs, pairs, schedule, policy/rate, adjustments, and shift-end transition', () => {
  const input: Parameters<typeof aggregationInputFingerprint>[0] = {
    date: '2026-11-19', shift: { shift_id: 1, shift_type: 'OFFICE_HOURS', start_time: '08:00', end_time: '17:00' },
    logs: [{ id: 1, type: 'CHECK_IN', event_time: '2026-11-19T01:00:00Z', status: 'VALID' }], pairs: [], ignored: [], pendingId: '1',
    hourlyRate: 100000, absenceRate: 2, adjustments: [], now: new Date('2026-11-19T09:00:00Z'),
  }
  const original = aggregationInputFingerprint(input)
  expect(aggregationInputFingerprint({ ...input, now: new Date('2026-11-19T09:30:00Z') })).toBe(original)
  for (const changes of [
    { logs: [...input.logs, { id: 2, type: 'CHECK_OUT', event_time: '2026-11-19T10:00:00Z' }] },
    { pairs: [{ inId: '1', outId: '2', start: new Date('2026-11-19T01:00:00Z'), end: new Date('2026-11-19T10:00:00Z'), workDate: input.date }] },
    { shift: { ...input.shift, end_time: '18:00' } },
    { hourlyRate: 120000 }, { absenceRate: 3 },
    { now: new Date('2026-11-19T10:00:00Z') },
    { adjustments: [{ kind: 'OVERTIME', hours: 1, amount: 0, status: 'REJECTED', source_fingerprint: 'new' }] },
  ]) expect(aggregationInputFingerprint({ ...input, ...changes })).not.toBe(original)
});
