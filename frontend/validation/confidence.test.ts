import { describe, expect, it } from 'vitest';
import { confidenceColor } from '../src/utils/confidence';

describe('confidence colors', () => {
  it('uses the same thresholds for fractional and percentage scores', () => {
    expect(confidenceColor(0.95)).toContain('emerald');
    expect(confidenceColor(94)).toContain('amber');
    expect(confidenceColor(0.8)).toContain('amber');
    expect(confidenceColor(0.79)).toContain('rose');
    expect(confidenceColor(null)).toContain('slate');
  });
});
