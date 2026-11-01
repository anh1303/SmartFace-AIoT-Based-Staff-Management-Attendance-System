// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAttendancePairs } from '../../src/features/attendances/hooks/useAttendancePairs'
import type { Employee, WorkShift, AttendanceRecord, DailyAttendanceSummary } from '../../src/types'

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

describe('Overnight checkout and UNASSIGNED row deduplication', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  const mockEmployee: Employee = {
    id: 'emp-uuid-1',
    employee_id: 'EMP001',
    full_name: 'Overnight Worker',
    department: 'Operations',
    position: 'Guard',
    status: 'ACTIVE',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }

  const overnightShift: WorkShift = {
    id: 'shift-1',
    employee_id: 'EMP001',
    date: '2026-10-25',
    shift_type: 'NIGHT',
    start_time: '22:00',
    end_time: '06:00',
  }

  const checkInRecord: AttendanceRecord = {
    id: 'log-in-1',
    employee_id: 'EMP001',
    type: 'CHECK_IN',
    timestamp: '2026-10-25T22:00:00+07:00',
    date: '2026-10-25',
    time: '22:00:00',
    method: 'FACE',
    status: 'VALID',
  }

  const checkOutRecord: AttendanceRecord = {
    id: 'log-out-1',
    employee_id: 'EMP001',
    type: 'CHECK_OUT',
    timestamp: '2026-10-26T06:00:00+07:00',
    date: '2026-10-26',
    time: '06:00:00',
    method: 'FACE',
    status: 'VALID',
  }

  const overnightSummary: DailyAttendanceSummary = {
    id: 'sum-1',
    employee_id: 'EMP001',
    date: '2026-10-25',
    total_working_hours: 8,
    late_early: 0,
    overtime: 0,
    status: 'PRESENT',
    calculation_details: {
      pairs: [
        {
          inId: 'log-in-1',
          outId: 'log-out-1',
          start: '2026-10-25T22:00:00+07:00',
          end: '2026-10-26T06:00:00+07:00',
        },
      ],
    },
  }

  it('does NOT create a phantom UNASSIGNED row on checkout date (2026-10-26) when viewing checkout date', async () => {
    let pairs: any[] = []

    function TestComponent() {
      const result = useAttendancePairs(
        [mockEmployee],
        [overnightShift],
        [checkOutRecord],
        '2026-10-26',
        '2026-10-26',
        '',
        'ALL',
        {},
        {},
        'ALL',
        'ALL',
        {
          'EMP001_2026-10-25': overnightSummary,
        }
      )
      pairs = result
      return <div data-testid="count">{result.length}</div>
    }

    await act(async () => {
      root.render(<TestComponent />)
    })

    const unassignedItems = pairs.filter(p => p.isUnassigned || p.shift_type === 'UNASSIGNED')
    expect(unassignedItems).toHaveLength(0)
  })

  it('correctly associates overnight pair to shift date (2026-10-25) when viewing both dates', async () => {
    let pairs: any[] = []

    function TestComponent() {
      const result = useAttendancePairs(
        [mockEmployee],
        [overnightShift],
        [checkInRecord, checkOutRecord],
        '2026-10-25',
        '2026-10-26',
        '',
        'ALL',
        {},
        {},
        'ALL',
        'ALL',
        {
          'EMP001_2026-10-25': overnightSummary,
        }
      )
      pairs = result
      return <div data-testid="count">{result.length}</div>
    }

    await act(async () => {
      root.render(<TestComponent />)
    })

    expect(pairs).toHaveLength(1)
    expect(pairs[0].date).toBe('2026-10-25')
    expect(pairs[0].shift.name).toBe('Ca qua đêm')
    expect(pairs[0].isUnassigned).toBeFalsy()
  })

  it('correctly displays standalone late checkout at 20:00 next day without disappearing', async () => {
    const lateCheckoutRecord: AttendanceRecord = {
      id: 'log-out-late',
      employee_id: 'EMP001',
      type: 'CHECK_OUT',
      timestamp: '2026-10-26T20:00:00+07:00',
      date: '2026-10-26',
      time: '20:00:00',
      method: 'FACE',
      status: 'VALID',
    }

    let pairs: any[] = []

    function TestComponent() {
      const result = useAttendancePairs(
        [mockEmployee],
        [overnightShift],
        [checkInRecord, checkOutRecord, lateCheckoutRecord],
        '2026-10-25',
        '2026-10-26',
        '',
        'ALL',
        {},
        {},
        'ALL',
        'ALL',
        {
          'EMP001_2026-10-25': overnightSummary,
        }
      )
      pairs = result
      return <div data-testid="count">{result.length}</div>
    }

    await act(async () => {
      root.render(<TestComponent />)
    })

    // Both the paired 06:00 overnight shift and standalone 20:00 unassigned checkout must display!
    expect(pairs).toHaveLength(2)

    const overnightRow = pairs.find(p => p.date === '2026-10-25')
    expect(overnightRow).toBeDefined()
    expect(overnightRow.shift.name).toBe('Ca qua đêm')

    const unassignedRow = pairs.find(p => p.date === '2026-10-26')
    expect(unassignedRow).toBeDefined()
    expect(unassignedRow.isUnassigned).toBe(true)
    expect(unassignedRow.rawEvents.some((e: any) => e.id === 'log-out-late')).toBe(true)
  })

  it('does NOT hide independent morning checkout at 10:00 when yesterday overnight shift already has a matched checkout at 06:00', async () => {
    const morningCheckoutRecord: AttendanceRecord = {
      id: 'log-out-morning-extra',
      employee_id: 'EMP001',
      type: 'CHECK_OUT',
      timestamp: '2026-10-26T10:00:00+07:00',
      date: '2026-10-26',
      time: '10:00:00',
      method: 'FACE',
      status: 'VALID',
    }

    let pairs: any[] = []

    function TestComponent() {
      const result = useAttendancePairs(
        [mockEmployee],
        [overnightShift],
        [checkInRecord, checkOutRecord, morningCheckoutRecord],
        '2026-10-25',
        '2026-10-26',
        '',
        'ALL',
        {},
        {},
        'ALL',
        'ALL',
        {
          'EMP001_2026-10-25': overnightSummary,
        }
      )
      pairs = result
      return <div data-testid="count">{result.length}</div>
    }

    await act(async () => {
      root.render(<TestComponent />)
    })

    // Both the paired 06:00 overnight shift and independent 10:00 unassigned checkout must display!
    expect(pairs).toHaveLength(2)

    const overnightRow = pairs.find(p => p.date === '2026-10-25')
    expect(overnightRow).toBeDefined()
    expect(overnightRow.shift.name).toBe('Ca qua đêm')

    const unassignedRow = pairs.find(p => p.date === '2026-10-26')
    expect(unassignedRow).toBeDefined()
    expect(unassignedRow.isUnassigned).toBe(true)
    expect(unassignedRow.rawEvents.some((e: any) => e.id === 'log-out-morning-extra')).toBe(true)
  })
})

