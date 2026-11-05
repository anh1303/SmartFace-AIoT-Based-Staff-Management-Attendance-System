import { computePayrollBreakdown, type SalaryCalculationInput, type PayrollBreakdown } from './payroll-rates.js';
export { computePayrollBreakdown };
export type { SalaryCalculationInput, PayrollBreakdown };

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Performance Optimization:
 * Singleton Intl.DateTimeFormat formatter to avoid allocating thousands of instances
 * during heavy batch attendance and payroll aggregation routines.
 */
const vnDateISOFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const vnTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Returns date formatted as YYYY-MM-DD in Vietnam local timezone (+07:00).
 */
export function formatVNDateISO(dateInput?: Date | string | number | null): string {
  if (!dateInput) {
    return vnDateISOFormatter.format(new Date());
  }
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return vnDateISOFormatter.format(new Date());
    }
    return vnDateISOFormatter.format(d);
  } catch {
    return vnDateISOFormatter.format(new Date());
  }
}

/**
 * Returns date formatted as YYYY-MM-DD in Vietnam local timezone (+07:00).
 */
export const vnDay = (value: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(+date) ? 'Invalid Date' : vnDateISOFormatter.format(date);
};

/**
 * Returns time formatted as HH:mm:ss in Vietnam local timezone (+07:00).
 */
export function formatVNTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '--:--:--';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '--:--:--';
    return vnTimeFormatter.format(d);
  } catch {
    return '--:--:--';
  }
}

/**
 * Formats a shift time (stored in Prisma as Date with 1970-01-01T{HH}:{mm}:{ss}Z, or string "HH:mm") to "HH:mm".
 * Uses UTC hours/minutes because PostgreSQL TIME columns are mapped by Prisma to 1970-01-01 UTC dates.
 */
export function formatShiftTime(val: unknown, fallback: string = '08:00'): string {
  if (!val) return fallback;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return fallback;
    const hours = String(val.getUTCHours()).padStart(2, '0');
    const minutes = String(val.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    }
    const match = val.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return val.slice(0, 5);
  }
  return fallback;
}

/**
 * Returns today's YYYY-MM-DD string in Vietnam timezone (+07:00).
 */
export function getTodayVNString(): string {
  return vnDateISOFormatter.format(new Date());
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if a string is a valid UUID v4 / RFC 4122 format.
 */
export function isValidUuid(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/**
 * Builds a Prisma `where` clause for the `Employee` model:
 * If the input is a UUID, filters by `{ id }`. Otherwise, filters by `{ employee_code }`.
 */
export function buildIdOrCodeWhere(idOrCode: string): { id: string } | { employee_code: string } {
  if (UUID_REGEX.test(idOrCode)) {
    return { id: idOrCode };
  }
  return { employee_code: idOrCode };
}

/**
 * Alias for buildIdOrCodeWhere with descriptive naming
 */
export const buildEmployeeWhere = buildIdOrCodeWhere;


/**
 * Pure Function để tính lương thực lĩnh (net_salary) dùng chung thống nhất toàn hệ thống.
 */
export function calculateNetSalary(params: SalaryCalculationInput): number {
  return computePayrollBreakdown(params).net_salary;
}

/**
 * Sinh mật khẩu ngẫu nhiên độ dài mặc định 8 ký tự.
 * Đảm bảo chứa cả chữ hoa, chữ thường và chữ số để an toàn và bảo mật.
 */
export function generateRandomPassword(length = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const chars: string[] = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];

  for (let i = 3; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Xáo trộn ngẫu nhiên (Fisher-Yates shuffle)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export function employeeLockKey(employeeId: string): string {
  return `employee:${employeeId}`;
}

export function payrollPeriodLockKey(period: string): string {
  return `payroll:${period}`;
}
