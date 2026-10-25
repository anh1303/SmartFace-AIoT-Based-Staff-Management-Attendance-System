import { describe, it, expect } from 'vitest'
import { calculateDay, pairAttendance, roundHours } from '../src/modules/attendance/attendance.policy.js'
const day = '2026-10-02'
const shift = { start_time: '08:00', end_time: '17:30', shift_type: 'OFFICE_HOURS' }
const log = (id: number, type: string, time: string, date = day) => ({ id, type, event_time: `${date}T${time}+07:00`, status: 'VALID' })
const calc = (logs: ReturnType<typeof log>[], assigned = shift) => calculateDay(day, logs, assigned, new Date('2026-10-03T12:00:00+07:00'))
describe('Company policy boundaries', () => {
  it.each([[0,0],[0.49,0],[0.5,0.5],[0.74,0.5],[0.75,1],[1.49,1],[1.5,1.5],[1.74,1.5],[1.75,2],[9.5,9.5]])('rounds %s hours to %s', (hours, expected) => expect(roundHours(hours * 3600)).toBe(expected))
  it.each([[1799,0],[1800,0.5],[2699,0.5],[2700,1],[5399,1],[5400,1.5],[6299,1.5],[6300,2]])('uses exact second boundaries at %s', (seconds, expected) => expect(roundHours(seconds)).toBe(expected))
  it('uses latest adjacent IN, ignores extra OUT', () => {
    const r = calc([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_IN','09:00:00'),log(3,'CHECK_OUT','17:30:00'),log(4,'CHECK_OUT','19:00:00')])
    expect(r.regularSeconds).toBe(8.5 * 3600); expect(r.workingHours).toBe(8.5); expect(r.overtimeSeconds).toBe(0)
    expect(r.details.pairs[0].inId).toBe('2')
  })
  it('sums pairs once, excludes time between pairs and early arrival', () => {
    const r = calc([log(1,'CHECK_IN','07:00:00'),log(2,'CHECK_OUT','10:20:00'),log(3,'CHECK_IN','11:00:00'),log(4,'CHECK_OUT','12:20:00')])
    expect(r.regularSeconds).toBe(13200); expect(r.workingHours).toBe(3.5)
  })
  it('pays the full shift without lunch deduction', () => expect(calc([log(1,'CHECK_IN','07:00:00'),log(2,'CHECK_OUT','17:30:00')]).workingHours).toBe(9.5))
  it.each([['18:00:00',0],['18:00:01',0.5],['18:10:00',0.5],['18:14:59',0.5],['18:15:00',1]])('uses raw >30min OT threshold at %s', (out, expected) => {
    const r = calc([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_OUT',out)])
    expect(r.overtimeCandidateHours).toBe(expected)
  })
  it.each([['21:30:00',false],['21:30:01',true]])('flags raw OT over four hours at %s', (out, expected) => expect(calc([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_OUT',out)]).requiresReview).toBe(expected))
  it('allows a 24h pair but rejects 24h plus a second', () => {
    const inside = pairAttendance([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_OUT','08:00:00','2026-10-03')])
    const outside = pairAttendance([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_OUT','08:00:01','2026-10-03')])
    expect(inside.pairs).toHaveLength(1); expect(inside.pairs[0].workDate).toBe(day); expect(outside.pairs).toHaveLength(0)
  })
  it('keeps OFF logs without automatic wages or OT', () => {
    const r = calc([log(1,'CHECK_IN','08:00:00'),log(2,'CHECK_OUT','21:00:00')], { start_time:'00:00',end_time:'00:00',shift_type:'OFF' })
    expect(r.details.pairs).toHaveLength(1); expect(r.workingHours).toBe(0); expect(r.overtimeCandidateHours).toBe(0)
  })
  it('does not synthesize an event or pay for unmatched scans', () => {
    const a = calc([log(1,'CHECK_IN','09:00:00')]); const b = calc([log(2,'CHECK_OUT','17:30:00')])
    expect(a.workingHours).toBe(0); expect(a.lateEarlyHours).toBe(0); expect(a.last).toBeNull(); expect(a.requiresReview).toBe(true)
    expect(b.first).toBeNull(); expect(b.workingHours).toBe(0); expect(b.requiresReview).toBe(true)
  })
  it('does not bridge flagged scans', () => {
    const r = calc([log(1,'CHECK_IN','08:00:00'), { ...log(2,'CHECK_IN','09:00:00'), status:'FLAGGED' }, log(3,'CHECK_OUT','17:30:00')])
    expect(r.workingHours).toBe(0); expect(r.requiresReview).toBe(true)
  })
  it('marks future shifts scheduled, without absence or wages', () => {
    expect(calculateDay(day,[],shift,new Date('2026-10-01T00:00:00Z')).status).toBe('SCHEDULED')
  })
  it('retains valid midnight times instead of falling back to 08:00', () => {
    const r = calc([log(1,'CHECK_IN','00:00:00'),log(2,'CHECK_OUT','02:00:00')], { start_time:'00:00',end_time:'02:00',shift_type:'MORNING' })
    expect(r.workingHours).toBe(2)
  })
})
