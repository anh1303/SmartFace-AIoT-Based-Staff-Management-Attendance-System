import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { useAttendancePairs } from '../../src/features/attendances/hooks/useAttendancePairs';
import type { AttendanceSummary } from '../../src/features/attendances/hooks/useAttendanceSummaries';
import type { AttendanceRecord, Employee, WorkShift } from '../../src/types';
const employee = { employee_id:'NV-001',full_name:'Test',department:'QA',position:'Tester' } as Employee;
const shift = { employee_id:'NV-001',date:'2026-10-02',start_time:'08:00',end_time:'17:30',shift_type:'OFFICE_HOURS' } as WorkShift;
function derive(summary?: Partial<AttendanceSummary>, assignment = shift, attendance: AttendanceRecord[] = []) {
  let result: ReturnType<typeof useAttendancePairs> = [];
  function Probe() {
    result = useAttendancePairs([employee], [assignment], attendance, '2026-10-02','2026-10-02','','ALL',{}, {}, 'ALL','ALL', summary ? { 'NV-001_2026-10-02':summary as AttendanceSummary } : {});
    return <span />;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}
describe('Attendance uses server policy results', () => {
  it.each([
    { time:'08:15:00', punctuality:'ON_TIME', expected:'ON_TIME', text:'Đúng giờ' },
    { time:'08:15:01', punctuality:'LATE', expected:'LATE', text:'Đi muộn' },
    { time:'08:30:00', punctuality:'LATE', expected:'LATE', text:'Đi muộn' },
    { time:'08:30:00', punctuality:'UNRECORDED', expected:'UNRECORDED', text:'UNRECORDED' },
  ] as const)('preserves check-in punctuality before checkout: $time $punctuality', ({time,punctuality,expected,text}) => {
    const record={id:'101',attendance_id:'ATT-101',employee_id:employee.employee_id,type:'CHECK_IN',timestamp:`2026-10-02T${time}+07:00`,status:'VALID',method:'FACE',punctuality} as AttendanceRecord;
    const [row]=derive({employee_id:employee.employee_id,date:shift.date,status:'INCOMPLETE',first_check_in:null,last_check_out:null,total_working_hours:0,requires_review:true,calculation_details:{events:[],pairs:[]}},shift,[record]);
    expect(row.events[0].status).toBe(expected);
    expect(row.events[0].statusText).toBe(text);
    expect(row.events[1].time).toBe('--:--:--');
    expect(row.workingHours).toBe(0);
  });
  it('preserves a late check-in on an incomplete day with a matched pair below the minimum shift', () => {
    const start='2026-10-02T15:48:49+07:00',end='2026-10-02T15:49:19+07:00';
    const records=[{id:'101',attendance_id:'ATT-101',employee_id:employee.employee_id,type:'CHECK_IN',timestamp:start,status:'VALID',method:'FACE',punctuality:'LATE'},{id:'102',attendance_id:'ATT-102',employee_id:employee.employee_id,type:'CHECK_OUT',timestamp:end,status:'VALID',method:'FACE',punctuality:'EARLY_LEAVE'}] as AttendanceRecord[];
    const [row]=derive({employee_id:employee.employee_id,date:shift.date,status:'INCOMPLETE',first_check_in:start,last_check_out:end,total_working_hours:0,requires_review:true,calculation_details:{events:[],pairs:[{inId:'101',outId:'102',start,end,counted:false}]}},shift,records);
    expect(row.events[0].status).toBe('LATE');
    expect(row.events[0].statusText).toBe('Đi muộn');
    expect(row.workingHours).toBe(0);
  });
  it('never fabricates wages or biometric scores when logs are unavailable', () => {
    const [row] = derive();
    expect(row.workingHours).toBe(0);expect(row.hasCheckedIn).toBe(false);
    expect(row.events.every(e => e.score === null)).toBe(true);
  });
  it('shows OFF days for retrospective OT approval', () => {
    const [row] = derive({ employee_id:'NV-001',date:'2026-10-02',total_working_hours:0,overtime:2,overtime_status:'APPROVED' }, {...shift,shift_type:'OFF'});
    expect(row.shift.name).toBe('Ngày OFF'); expect(row.workingHours).toBe(0);expect(row.currentOTSec).toBe(7200);
  });
  it('shows actual pairs and uses authoritative hours, not the first/last span', () => {
    const [row] = derive({ employee_id:'NV-001',date:'2026-10-02',first_check_in:'2026-10-02T01:00:00Z',last_check_out:'2026-10-02T10:30:00Z',total_working_hours:7,overtime:0,overtime_candidate_hours:1,overtime_status:'PENDING',review_reason:'OT_OVER_4H',calculation_details:{pairs:[{inId:'1',outId:'2',start:'2026-10-02T01:00:00Z',end:'2026-10-02T03:00:00Z'},{inId:'3',outId:'4',start:'2026-10-02T05:00:00Z',end:'2026-10-02T10:30:00Z'}]} });
    expect(row.workingHours).toBe(7);expect(row.pairIntervals).toHaveLength(2);
    expect(row.currentOTSec).toBe(0);expect(row.candidateHours).toBe(1);expect(row.overtimeStatus).toBe('PENDING');
    expect(row.reviewReason).toBe('OT_OVER_4H');
  });
});
