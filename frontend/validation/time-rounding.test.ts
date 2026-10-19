import { describe, expect, it } from 'vitest';
import { roundPayableHours } from '../src/utils/timeUtils';
describe('Draft time rounding matches company bands', () => {
  it.each([[1799,0],[1800,0.5],[2400,0.5],[2699,0.5],[2700,1],[5364,1],[5400,1.5],[6264,1.5],[6300,2],[34200,9.5]])('rounds %s seconds to %s hours', (seconds, expected) => expect(roundPayableHours(seconds)).toBe(expected));
});
