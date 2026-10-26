import { describe, it, expect } from 'vitest'
import { STANDARD_SHIFT_CONFIGS } from '../src/modules/shifts/shift.service.js'

describe('Standard Shift Configurations & Rules', () => {
  it('has exact standard fixed hours for office, morning, afternoon shifts and OFF', () => {
    // Ca Hành Chính: 08:00 - 17:00 (cố định)
    expect(STANDARD_SHIFT_CONFIGS.OFFICE_HOURS.start_time).toBe('08:00')
    expect(STANDARD_SHIFT_CONFIGS.OFFICE_HOURS.end_time).toBe('17:00')
    expect(STANDARD_SHIFT_CONFIGS.OFFICE_HOURS.is_fixed).toBe(true)

    // Ca Sáng: 08:00 - 12:00 (cố định)
    expect(STANDARD_SHIFT_CONFIGS.MORNING.start_time).toBe('08:00')
    expect(STANDARD_SHIFT_CONFIGS.MORNING.end_time).toBe('12:00')
    expect(STANDARD_SHIFT_CONFIGS.MORNING.is_fixed).toBe(true)

    // Ca Chiều: 13:00 - 17:00 (cố định)
    expect(STANDARD_SHIFT_CONFIGS.AFTERNOON.start_time).toBe('13:00')
    expect(STANDARD_SHIFT_CONFIGS.AFTERNOON.end_time).toBe('17:00')
    expect(STANDARD_SHIFT_CONFIGS.AFTERNOON.is_fixed).toBe(true)

    // Ca khác: 00:00 - 00:00 (mặc định, cho phép sửa giờ)
    expect(STANDARD_SHIFT_CONFIGS.OTHER.start_time).toBe('00:00')
    expect(STANDARD_SHIFT_CONFIGS.OTHER.end_time).toBe('00:00')
    expect(STANDARD_SHIFT_CONFIGS.OTHER.is_fixed).toBe(false)

    // Nghỉ ca: 00:00 - 00:00 (cố định)
    expect(STANDARD_SHIFT_CONFIGS.OFF.start_time).toBe('00:00')
    expect(STANDARD_SHIFT_CONFIGS.OFF.end_time).toBe('00:00')
    expect(STANDARD_SHIFT_CONFIGS.OFF.is_fixed).toBe(true)
  })

  it('validates Ca khác constraints: start time must be strictly less than end time and not 00:00 - 00:00', () => {
    const validateOtherHours = (start?: string, end?: string) => {
      const rawStart = start?.trim() || ''
      const rawEnd = end?.trim() || ''
      if (!rawStart || !rawEnd || (rawStart === '00:00' && rawEnd === '00:00') || rawStart >= rawEnd) {
        return false
      }
      return true
    }

    // Default 00:00 - 00:00 must be blocked
    expect(validateOtherHours('00:00', '00:00')).toBe(false)
    expect(validateOtherHours('', '')).toBe(false)
    expect(validateOtherHours('08:00', '08:00')).toBe(false)

    // Inverted hours (e.g. 23:00 - 22:00 or 22:00 - 06:00) must be blocked
    expect(validateOtherHours('23:00', '22:00')).toBe(false)
    expect(validateOtherHours('22:00', '06:00')).toBe(false)
    expect(validateOtherHours('17:00', '08:00')).toBe(false)

    // Valid forward hours must be allowed
    expect(validateOtherHours('07:00', '09:00')).toBe(true)
    expect(validateOtherHours('13:00', '16:00')).toBe(true)
    expect(validateOtherHours('18:00', '22:00')).toBe(true)
    expect(validateOtherHours('08:00', '17:00')).toBe(true)
  })
})
