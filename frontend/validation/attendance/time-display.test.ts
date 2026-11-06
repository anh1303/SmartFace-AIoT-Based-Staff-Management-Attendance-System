import { describe, expect, it } from 'vitest';
import { formatSecondsToHHMMSS } from '../../src/utils/timeUtils';
import { formatVNTime } from '../../src/utils/dateUtils';

describe('attendance time display', () => {
  it.each([
    [62.079000000000006, '00:01:02'],
    [0.999, '00:00:00'],
    [59.999, '00:00:59'],
    [60, '00:01:00'],
    [3599.999, '00:59:59'],
    [3600.001, '01:00:00'],
    [90061.999, '25:01:01'],
    [-1, '00:00:00'],
    [NaN, '00:00:00'],
    [Infinity, '00:00:00'],
  ])('formats %s seconds as %s without fractional seconds', (seconds, expected) => {
    expect(formatSecondsToHHMMSS(seconds)).toBe(expected);
  });

  it('formats check-in/out timestamps with milliseconds as whole seconds in Vietnam time', () => {
    expect(formatVNTime('2026-11-06T01:02:03.079Z')).toBe('08:02:03');
  });
});
