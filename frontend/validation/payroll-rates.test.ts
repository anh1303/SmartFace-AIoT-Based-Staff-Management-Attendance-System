import { describe, expect, it } from 'vitest';
import { calcPayrollAmount, formatPayrollRateLabel } from '../src/utils/payrollUtils';

describe('Explicit payroll units', () => {
  it('supports small fixed rates without treating them as multipliers', () => {
    expect(calcPayrollAmount(2, 5, 100000, 'FIXED_PER_HOUR')).toBe(10);
  });
  it('uses explicit multiplier units', () => {
    expect(calcPayrollAmount(2, 5, 100000, 'HOURLY_MULTIPLIER')).toBe(1000000);
  });
  it('preserves a zero hourly wage for fixed rates and a zero rate for multipliers', () => {
    expect(calcPayrollAmount(2, 5, 0, 'FIXED_PER_HOUR')).toBe(10);
    expect(calcPayrollAmount(2, 0, 100000, 'HOURLY_MULTIPLIER')).toBe(0);
  });
  it('labels units using the saved kind', () => {
    expect(formatPayrollRateLabel(5, 100000, 'FIXED_PER_HOUR')).toBe('5 ₫/h');
    expect(formatPayrollRateLabel(5, 100000, 'HOURLY_MULTIPLIER')).toBe('5x lương giờ (500.000 ₫/h)');
  });
});
