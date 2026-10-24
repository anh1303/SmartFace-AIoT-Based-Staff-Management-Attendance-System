import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { useAttendancePairs } from '../src/hooks/useAttendancePairs';
import type { AttendanceSummary } from '../src/features/attendance/hooks/useAttendanceSummaries';
import type { Employee, WorkShift } from '../src/types';
const employee = { employee_id:'NV-001',full_name:'Test',department:'QA',position:'Tester' } as Employee;
const shift = { employee_id:'NV-001',date:'2026-10-02',start_time:'08:00',end_time:'17:30',shift_type:'OFFICE_HOURS' } as WorkShift;
function derive(summary?: Partial<AttendanceSummary>, assignment = shift) {
  let result: ReturnType<typeof useAttendancePairs> = [];
  function Probe() {
    result = useAttendancePairs([employee], [assignment], [], '2026-10-02','2026-10-02','','ALL',{}, {}, 'ALL','ALL', summary ? { 'NV-001_2026-10-02':summary as AttendanceSummary } : {});
    return <span />;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}
describe('Attendance uses server policy results', () => {
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
