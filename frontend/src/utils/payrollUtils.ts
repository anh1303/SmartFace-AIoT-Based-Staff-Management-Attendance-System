import type { RateKind } from '../types/payroll.types';

/** The fourth argument is the saved unit; omitted units mean fixed currency per hour. */
export function calcPayrollAmount(hours: number, rate: number, hourlyRate: number, kind: RateKind = 'FIXED_PER_HOUR'): number {
  if (!hours || hours <= 0 || !rate || rate <= 0) return 0;
  return kind === 'HOURLY_MULTIPLIER' ? hours * rate * hourlyRate : hours * rate;
}

/** The third argument is the saved unit; hourlyRate only expands multiplier labels. */
export function formatPayrollRateLabel(rate: number, hourlyRate?: number, kind: RateKind = 'FIXED_PER_HOUR'): string {
  if (kind === 'HOURLY_MULTIPLIER') {
    return hourlyRate
      ? `${rate}x lương giờ (${(rate * hourlyRate).toLocaleString('vi-VN')} ₫/h)`
      : `${rate}x`;
  }
  return `${rate.toLocaleString('vi-VN')} ₫/h`;
}
