import { describe, expect, it } from 'vitest';
import { calcPayrollAmount, formatPayrollRateLabel } from '../../src/utils/payrollUtils';

describe('Multiplier payroll calculations and formatting', () => {
  it('calculates amount using multiplier formula: hours * multiplier * hourlyRate', () => {
    // 2 giờ OT với hệ số 2.0 và lương giờ 100.000 ₫/h = 400.000 ₫
    expect(calcPayrollAmount(2, 2.0, 100000)).toBe(400000);
    // 1 giờ trễ với hệ số 1.5 và lương giờ 100.000 ₫/h = 150.000 ₫
    expect(calcPayrollAmount(1, 1.5, 100000)).toBe(150000);
  });

  it('handles zero hours, zero multiplier or zero wage safely', () => {
    expect(calcPayrollAmount(0, 2.0, 100000)).toBe(0);
    expect(calcPayrollAmount(2, 0, 100000)).toBe(0);
    expect(calcPayrollAmount(2, 2.0, 0)).toBe(0);
  });

  it('labels multiplier rates with or without expanded hourly amounts', () => {
    expect(formatPayrollRateLabel(2.0)).toBe('2x');
    expect(formatPayrollRateLabel(1.5, 100000)).toBe('1.5x lương giờ (150.000 ₫/h)');
    expect(formatPayrollRateLabel(2.0, 80000)).toBe('2x lương giờ (160.000 ₫/h)');
  });
});
