/**
 * Formats a shift time (stored in Prisma as Date with 1970-01-01T{HH}:{mm}:{ss}Z, or string "HH:mm") to "HH:mm".
 * Uses UTC hours/minutes because PostgreSQL TIME columns are mapped by Prisma to 1970-01-01 UTC dates.
 */
export function formatShiftTime(val: unknown, fallback: string = '08:00'): string {
  if (!val) return fallback
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return fallback
    const hours = String(val.getUTCHours()).padStart(2, '0')
    const minutes = String(val.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        const hours = String(d.getUTCHours()).padStart(2, '0')
        const minutes = String(d.getUTCMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
      }
    }
    const match = val.match(/^(\d{1,2}):(\d{2})/)
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`
    }
    return val.slice(0, 5)
  }
  return fallback
}
