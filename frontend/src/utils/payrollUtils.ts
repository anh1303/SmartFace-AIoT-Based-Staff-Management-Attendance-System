/**
 * Utility functions for payroll calculations and rate formatting.
 * Consolidates the standard business logic across Manager and Employee modules:
 * - When rate <= 10, it is treated as a multiplier of hourlyRate: amount = hours * rate * hourlyRate
 * - When rate > 10, it is treated as a fixed monetary rate per hour: amount = hours * rate
 */

export function calcPayrollAmount(hours: number, rate: number, hourlyRate: number): number {
  if (!hours || hours <= 0 || !rate || rate <= 0) return 0;
  return rate <= 10 ? hours * rate * hourlyRate : hours * rate;
}

export function formatPayrollRateLabel(rate: number, hourlyRate?: number): string {
  if (rate <= 10) {
    return hourlyRate
      ? `${rate}x lương giờ (${(rate * hourlyRate).toLocaleString('vi-VN')} ₫/h)`
      : `${rate}x`;
  }
  return `${rate.toLocaleString('vi-VN')} ₫/h`;
}
