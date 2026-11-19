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
