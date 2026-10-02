/**
 * Utility functions for date and time handling using Vietnam timezone (Asia/Ho_Chi_Minh - GMT+7).
 * Ensures consistency between DB ISO timestamps and Frontend display.
 * 
 * PERFORMANCE OPTIMIZATION:
 * Uses pre-instantiated singleton Intl.DateTimeFormat formatters to prevent garbage collection spikes
 * and performance degradation when formatting thousands of records in large tables/lists.
 */

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Singleton Intl formatters
const vnDateISOFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const vnDateGBFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const vnTimeWithSecondsFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TIMEZONE,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const vnTimeWithoutSecondsFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TIMEZONE,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Returns today's date in YYYY-MM-DD format based on Vietnam local time.
 */
export function getTodayVNString(): string {
  return vnDateISOFormatter.format(new Date()); // Outputs YYYY-MM-DD
}

/**
 * Formats a Date object, ISO string, or timestamp into YYYY-MM-DD in Vietnam timezone (en-CA locale).
 */
export function formatVNDateISO(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return getTodayVNString();
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return getTodayVNString();
    return vnDateISOFormatter.format(d);
  } catch {
    return getTodayVNString();
  }
}

/**
 * Formats a Date object or ISO string to HH:mm:ss (or HH:mm if includeSeconds=false) in Vietnam timezone.
 */
export function formatVNTime(
  dateInput: Date | string | number | null | undefined,
  includeSeconds: boolean = true
): string {
  if (!dateInput) return '--:--:--';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '--:--:--';

    return includeSeconds
      ? vnTimeWithSecondsFormatter.format(d)
      : vnTimeWithoutSecondsFormatter.format(d);
  } catch {
    return '--:--:--';
  }
}

/**
 * Formats a Date object or ISO string to DD/MM/YYYY in Vietnam timezone.
 */
export function formatVNDate(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return '--/--/----';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '--/--/----';

    return vnDateGBFormatter.format(d);
  } catch {
    return '--/--/----';
  }
}

/**
 * Formats a Date object or ISO string to full DD/MM/YYYY HH:mm:ss in Vietnam timezone.
 */
export function formatVNDatetime(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return '--/--/---- --:--:--';
  const dateStr = formatVNDate(dateInput);
  const timeStr = formatVNTime(dateInput, true);
  if (dateStr === '--/--/----' || timeStr === '--:--:--') return '--/--/---- --:--:--';
  return `${dateStr} ${timeStr}`;
}

/**
 * Converts a Date object or string into a standard UTC ISO 8601 string.
 */
export function toUTCISOString(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toISOString();
}

/**
 * Given a YYYY-MM-DD date string and an HH:mm or HH:mm:ss time string in Vietnam local time,
 * creates an ISO string in UTC.
 */
export function createISOFromVNTime(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return new Date().toISOString();
  // Format: YYYY-MM-DDTHH:mm:ss+07:00
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const vnIsoString = `${dateStr}T${normalizedTime}+07:00`;
  const d = new Date(vnIsoString);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}