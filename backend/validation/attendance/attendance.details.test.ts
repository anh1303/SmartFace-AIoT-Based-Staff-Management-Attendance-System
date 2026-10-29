import { describe, it, expect, vi } from 'vitest'
import { annotatePairCredits, projectAttendanceDetails } from '../../src/modules/attendance/attendance.details.js'
import { syncDayAdjustments, flushAdjustmentBatch } from '../../src/modules/attendance/attendance.adjustments.js'
const context = {start:'2026-10-26T08:00:00+07:00',end:'2026-10-26T18:00:00+07:00',scheduledSeconds:36000,workingHours:10,candidateHours:0,off:false}
describe('Per-checkout work credits and bounded DB writes', () => {
  it('projects the exact legacy 10-hour screenshot without changing the saved summary', () => {
    const old={off:false,scheduledStart:context.start,scheduledEnd:context.end,scheduledShiftSeconds:36000,meetsHalfShift:true,policy:'2026-10-25-v4',pairs:[{inId:'6396',outId:'6397',start:'2026-10-26T07:52:43+07:00',end:'2026-10-26T17:47:36+07:00'}]}
    const projected=projectAttendanceDetails(old,10,0) as any
    expect(projected.pairs[0].regular_seconds).toBe(35256)
    expect(projected.pairs[0].credited_regular_seconds).toBe(36000)
    expect(projected.pairs[0].counted).toBe(true)
    expect(old.pairs[0]).not.toHaveProperty('counted');expect(projected.policy).toBe(old.policy)
  })
  it('keeps OFF pairs matched but unpaid, including the two short pairs in the screenshot', () => {
    const pairs=[{start:'2026-10-25T20:50:51.527+07:00',end:'2026-10-25T20:50:56.394+07:00'},{start:'2026-10-25T20:51:26.171+07:00',end:'2026-10-25T20:51:30.250+07:00'}]
    const details=annotatePairCredits(pairs,{...context,workingHours:0,off:true,scheduledSeconds:0})
    expect(details).toHaveLength(2);expect(details.every(p=>p.credited_regular_seconds===0&&p.credit_reason==='OFF')).toBe(true)
  })
  it('credits the full shift only at the checkout crossing half shift', () => {
    const pairs=annotatePairCredits([{start:'2026-10-26T08:00:00+07:00',end:'2026-10-26T12:00:00+07:00'},{start:'2026-10-26T13:00:00+07:00',end:'2026-10-26T16:00:00+07:00'},{start:'2026-10-26T16:30:00+07:00',end:'2026-10-26T19:00:00+07:00'}],{...context,candidateHours:1})
    expect(pairs.map(p=>p.credited_regular_seconds)).toEqual([0,36000,0])
    expect(pairs[2].overtime_seconds).toBe(3600)
    expect(pairs[2].credit_reason).toBe('FULL_SHIFT_ALREADY_CREDITED')
  })
  it('buffers existing adjustment updates instead of making one DB call per item', async () => {
    const batch:any={existing:new Map(),writes:[],audits:[]}
    const tx:any={$executeRaw:vi.fn(),auditLog:{createMany:vi.fn()}}
    for(let i=0;i<100;i++) {
      const id=`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`
      batch.existing.set(`${id}:2026-10-26:OVERTIME`,{id:BigInt(i+1),status:'APPROVED',source_fingerprint:'old',note:'checked'})
      await syncDayAdjustments(tx,{employee_id:id,work_date:new Date('2026-10-26T00:00:00Z'),overtime_candidate_hours:2,overtime:0,overtime_status:'PENDING',late_early:0,calculation_details:{fingerprint:'new',policy:'v5'}},100000,.25,batch)
    }
    expect(tx.$executeRaw).not.toHaveBeenCalled();expect(batch.writes).toHaveLength(100)
    await flushAdjustmentBatch(tx,batch)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1)
    expect(batch.writes.every((w:any)=>w.status==='PENDING'&&w.note==='checked')).toBe(true)
  })
})
