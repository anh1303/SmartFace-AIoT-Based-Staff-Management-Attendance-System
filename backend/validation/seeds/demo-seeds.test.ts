import { describe, expect, it } from 'vitest'
import { parseRange, datesInRange, ownedLogDates, shouldSkip } from '../../prisma/seed-utils.js'
import { buildShiftPlan } from '../../prisma/seed-shifts.js'
import { buildScenarioLogs, chooseScenario, WORK_CASES, CASE_WEIGHTS } from '../../prisma/seed-attendance.js'
import { calculateDay } from '../../src/modules/attendance/attendance.policy.js'

describe('seed input and overwrite scope', () => {
  it('accepts leap months, individual dates and inclusive cross-month ranges', () => {
    expect(datesInRange(parseRange(['2028-02']))).toHaveLength(29)
    expect(datesInRange(parseRange(['2026-10-31', '2026-11-02']))).toEqual(['2026-10-31', '2026-11-01', '2026-11-02'])
    expect(parseRange(['2026-11-02'])).toEqual({ from: '2026-11-02', to: '2026-11-02' })
  })
  it.each([['2026-02-29'], ['2026-13'], ['2026-11-10', '2026-11-01'], ['2026-01-01', '2028-01-01'], []])('rejects invalid input %j', (...args) => {
    expect(() => parseRange(args as string[])).toThrow()
  })
  it('preserves existing employee-days only in skip mode and always protects closed days', () => {
    expect(shouldSkip('skip', true, false)).toBe(true)
    expect(shouldSkip('overwrite', true, false)).toBe(false)
    expect(shouldSkip('overwrite', true, true)).toBe(true)
    expect(shouldSkip('skip', false, false)).toBe(false)
  })
  it('owns legacy overnight checkout by the shift start date, preserving the neighboring day', () => {
    const shifts = [{ work_date: '2026-10-31', shift_type: 'OTHER', start_time: '22:00', end_time: '06:00' }]
    const logs = [
      { id: 1n, type: 'CHECK_IN', event_time: new Date('2026-10-31T22:00:00+07:00'), work_date: null },
      { id: 2n, type: 'CHECK_OUT', event_time: new Date('2026-11-01T06:00:00+07:00'), work_date: null },
      { id: 3n, type: 'CHECK_IN', event_time: new Date('2026-11-01T13:00:00+07:00'), work_date: new Date('2026-11-01T00:00:00Z') },
    ]
    expect([...ownedLogDates(logs, shifts).values()]).toEqual(['2026-10-31', '2026-10-31', '2026-11-01'])
  })
})

describe('monthly shift coverage', () => {
  it('uses department/position schedules, respects hiring and rests after overnight shifts', () => {
    const employees = ['HR', 'ACC', 'SALE', 'MKT', 'IT', 'CS'].flatMap(code => ['MANAGER', 'EMPLOYEE', 'EMPLOYEE'].map((level, index) => ({
      id: `${code}-${index}`, createdAt: new Date('2026-11-03T00:00:00Z'), department: { department_code: code }, position: { level },
    })))
    const plan = buildShiftPlan(employees, parseRange(['2026-11']))
    expect(new Set(plan.map(p => p.shift_type)).size).toBe(5)
    expect(plan[0].date).toBe('2026-11-03')
    const working = plan.filter(p => p.shift_type !== 'OFF')
    expect(working.filter(p => p.shift_type === 'OFFICE_HOURS').length / working.length).toBeGreaterThan(0.65)
    for (const item of plan) {
      const weekday = new Date(`${item.date}T00:00:00Z`).getUTCDay()
      if (weekday === 0 || weekday === 6) expect(item.shift_type).toBe('OFF')
      if (item.employee_id.endsWith('-0') && weekday > 0 && weekday < 6) expect(item.shift_type).toBe('OFFICE_HOURS')
      if (item.shift_type === 'OTHER') {
        expect(item.employee_id).toMatch(/^IT-/)
        const next = plan[plan.indexOf(item) + 1]
        if (next?.employee_id === item.employee_id) expect(next.shift_type).toBe('OFF')
      }
    }
    const subset = buildShiftPlan(employees, { from: '2026-11-10', to: '2026-11-12' })
    expect(subset).toEqual(plan.filter(p => p.date >= '2026-11-10' && p.date <= '2026-11-12'))
  })
})

describe('realistic attendance proportions', () => {
  it('uses the proposed working-day percentages and rare OFF attendance', () => {
    expect(Object.values(CASE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(100)
    const counts: Record<string, number> = {}
    let offWork = 0
    for (let i = 0; i < 10000; i++) {
      const key = `employee-${i}:2026-11-02`
      const scenario = chooseScenario(key, false)
      counts[scenario] = (counts[scenario] ?? 0) + 1
      if (chooseScenario(key, true) === 'OFF_WORK') offWork++
    }
    expect(counts.ON_TIME / 10000).toBeGreaterThan(0.68)
    expect(counts.ON_TIME / 10000).toBeLessThan(0.72)
    expect(counts.LATE / 10000).toBeGreaterThan(0.09)
    expect(counts.LATE / 10000).toBeLessThan(0.11)
    expect(counts.OT_OVER_LIMIT / 10000).toBeLessThan(0.004)
    expect(offWork / 10000).toBeLessThan(0.03)
    expect(offWork).toBeGreaterThan(100)
    for (const scenario of WORK_CASES) expect(counts[scenario]).toBeGreaterThan(0)
    expect(chooseScenario('same employee and date', false)).toBe(chooseScenario('same employee and date', false))
  })
})

describe('attendance case coverage using the production policy', () => {
  const date = '2026-11-02'
  const shift = { work_date: date, shift_type: 'OFFICE_HOURS', start_time: '08:00', end_time: '17:00' }
  const calculate = (name: typeof WORK_CASES[number]) => calculateDay(date, buildScenarioLogs(date, shift, name), shift, new Date('2026-11-04T00:00:00Z'))
  it('generates punctual, late, early, combined, absent and missing-scan cases', () => {
    expect(calculate('ON_TIME').status).toBe('PRESENT')
    expect(calculate('LATE').status).toBe('LATE')
    expect(calculate('EARLY_LEAVE').status).toBe('EARLY_LEAVE')
    expect(calculate('LATE_AND_EARLY').status).toBe('LATE_AND_EARLY')
    expect(calculate('ABSENT').absenceCandidate).toBe(true)
    expect(calculate('MISSING_IN').reviewReason).toContain('UNPAIRED_CHECK_OUT')
    expect(calculate('MISSING_OUT').reviewReason).toContain('MISSING_CHECK_OUT')
  })
  it('covers minimum duration, multiple pairs, repeated scans, flagged events and OT thresholds', () => {
    expect(calculate('UNDER_MINIMUM').reviewReason).toContain('UNDER_MINIMUM_SHIFT')
    expect(calculate('MULTIPLE_PAIRS').details.pairs).toHaveLength(2)
    expect(calculate('REPEATED_IN').details.ignored[0].reason).toBe('REPLACED_CHECK_IN')
    expect(calculate('FLAGGED').reviewReason).toContain('FLAGGED_EVENT')
    expect(calculate('OT_BELOW_THRESHOLD').overtimeCandidateHours).toBe(0)
    expect(calculate('OVERTIME').overtimeCandidateHours).toBeGreaterThanOrEqual(0.5)
    expect(calculate('OVERTIME').overtimeCandidateHours).toBeLessThanOrEqual(2)
    expect(calculate('OT_OVER_LIMIT').reviewReason).toContain('OT_OVER_4H')
  })
  it('keeps overnight pairs on their start day and OFF attendance visible without ordinary work hours', () => {
    const night = { ...shift, shift_type: 'OTHER', start_time: '22:00', end_time: '06:00' }
    const result = calculateDay(date, buildScenarioLogs(date, night, 'ON_TIME'), night)
    expect(result.details.pairs[0].workDate).toBe(date)
    expect(result.workingHours).toBe(8)
    const off = { ...shift, shift_type: 'OFF', start_time: '00:00', end_time: '00:00' }
    const workOff = calculateDay(date, buildScenarioLogs(date, off, 'OFF_WORK'), off)
    expect(workOff.status).toBe('OFF')
    expect(workOff.details.events).toHaveLength(2)
    expect(workOff.workingHours).toBe(0)
  })
  it('varies scan seconds and normal arrival times reproducibly without unintended penalties or OT', () => {
    const starts = new Set<number>()
    const overtimeMinutes = new Set<number>()
    for (let i = 0; i < 100; i++) {
      const key = `employee-${i}:${date}`
      const logs = buildScenarioLogs(date, shift, 'ON_TIME', key)
      starts.add(+new Date(logs[0].event_time))
      expect(buildScenarioLogs(date, shift, 'ON_TIME', key)).toEqual(logs)
      const normal = calculateDay(date, logs, shift)
      expect(normal.status).toBe('PRESENT')
      expect(normal.lateEarlySeconds).toBe(0)
      expect(normal.overtimeCandidateHours).toBe(0)
      const ot = buildScenarioLogs(date, shift, 'OVERTIME', key)
      overtimeMinutes.add(+new Date(ot[1].event_time))
    }
    expect(starts.size).toBeGreaterThan(80)
    expect(overtimeMinutes.size).toBeGreaterThan(80)
  })
})
