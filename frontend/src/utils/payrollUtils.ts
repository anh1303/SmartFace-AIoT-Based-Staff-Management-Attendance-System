/**
 * Tính số tiền theo công thức hệ số: Số giờ * Hệ số * Lương theo giờ
 */
export function calcPayrollAmount(hours: number, rate: number, hourlyRate: number): number {
  if (!hours || hours <= 0 || !rate || rate <= 0) return 0;
  return hours * rate * hourlyRate;
}

/**
 * Hiển thị nhãn hệ số lương (ví dụ: "2x" hoặc "2x lương giờ (200.000 ₫/h)")
 */
export function formatPayrollRateLabel(rate: number, hourlyRate?: number): string {
  if (hourlyRate) {
    return `${rate}x lương giờ (${Math.round(rate * hourlyRate).toLocaleString('vi-VN')} ₫/h)`;
  }
  return `${rate}x`;
}

export function nextPayrollPolicyPeriod(): string {
  const [year, month] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}
