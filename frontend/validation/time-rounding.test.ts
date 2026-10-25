import { describe, expect, it } from 'vitest';
import { roundPayableHours } from '../src/utils/timeUtils';
describe('Draft time rounding matches half-hour floor rule (0-29m -> 0h, 30-59m -> 0.5h)', () => {
  it.each([
    [1799, 0],
    [1800, 0.5],
    [2400, 0.5],
    [2699, 0.5],
    [2700, 0.5],
    [3599, 0.5],
    [3600, 1],
    [5364, 1],
    [5400, 1.5],
    [6264, 1.5],
    [6300, 1.5],
    [7199, 1.5],
    [7200, 2],
    [34200, 9.5]
  ])('rounds %s seconds to %s hours', (seconds, expected) => expect(roundPayableHours(seconds)).toBe(expected));
});
