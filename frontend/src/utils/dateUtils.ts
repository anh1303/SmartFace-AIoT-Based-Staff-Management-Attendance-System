/**
 * Utility functions for date and time handling using Vietnam timezone (Asia/Ho_Chi_Minh - GMT+7).
 * Ensures consistency between DB ISO timestamps and Frontend display.
 */

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Returns today's date in YYYY-MM-DD format based on Vietnam local time.
 */
export function getTodayVNString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Outputs YYYY-MM-DD
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

    return d.toLocaleTimeString('vi-VN', {
      timeZone: VN_TIMEZONE,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
    });
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

    return d.toLocaleDateString('vi-VN', {
      timeZone: VN_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
