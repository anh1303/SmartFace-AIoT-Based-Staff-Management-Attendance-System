// @vitest-environment jsdom
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AttendanceDayDetails } from '../../src/features/attendances/components/AttendanceDayDetails'
import type { AttendancePairItem } from '../../src/features/attendances/hooks/useAttendancePairs'

describe('Attendance reason labels', () => {
  it('displays backend labels instead of raw reason codes', () => {
    const item = {
      workingHours: 0, validIntervals: [], rawEvents: [], needsReview: true,
      reviewReason: 'NO_VALID_PAIR,UNPAIRED_CHECK_OUT',
      reasonLabels: { NO_VALID_PAIR: 'Không có cặp hợp lệ', UNPAIRED_CHECK_OUT: 'Thiếu lượt vào' },
    } as unknown as AttendancePairItem
    const html = renderToStaticMarkup(<AttendanceDayDetails item={item} />)
    expect(html).toContain('Không có cặp hợp lệ; Thiếu lượt vào')
    expect(html).not.toContain('NO_VALID_PAIR')
  })
})
