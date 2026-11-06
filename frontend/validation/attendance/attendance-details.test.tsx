// @vitest-environment jsdom
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttendanceDayDetails } from '../../src/features/attendances/components/AttendanceDayDetails';
import { AdjustmentReviewPanel } from '../../src/features/payrolls/components/AdjustmentReviewPanel';
import { useAttendancePairs } from '../../src/features/attendances/hooks/useAttendancePairs';
import type { AttendancePairItem } from '../../src/features/attendances/hooks/useAttendancePairs';
import type { Employee, WorkShift } from '../../src/types';
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('../../src/context/ToastContext', () => ({ useToast: () => ({showToast:vi.fn()}) }));
import { apiFetch } from '../../src/api/client';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, cache: QueryClient;
beforeEach(() => { host=document.createElement('div');document.body.append(host);root=createRoot(host);cache=new QueryClient({defaultOptions:{queries:{retry:false}}});vi.clearAllMocks(); });
afterEach(async () => {await act(async()=>root.unmount());host.remove();cache.clear();});
const mount = async (component: React.ReactNode) => { await act(async()=> { root.render(<MemoryRouter><QueryClientProvider client={cache}>{component}</QueryClientProvider></MemoryRouter>); }); };
const click = async (element: Element | null) => { expect(element).toBeTruthy();await act(async()=>{(element as HTMLElement).click();}); };
const filter = async (value: string) => {
  const labels: Record<string, string> = { ALL: 'Tất cả lượt checkin / checkout', MATCHED: 'Chỉ lượt ghép cặp hợp lệ', COUNTED: 'Chỉ lượt được ghép cặp và tính giờ' };
  await click(host.querySelector('[role="combobox"][aria-label="Hiển thị lượt:"]'));
  await click([...host.querySelectorAll('[role="option"]')].find(option => option.textContent === labels[value]) || null);
};
const settle = async () => { await act(async()=>{await new Promise(r=>setTimeout(r,10));}); };
const events = [
  {id:'1',type:'CHECK_IN',time:'22:00:00',timestamp:'2026-09-30T22:00:00+07:00',rawStatus:'VALID'},
  {id:'2',type:'CHECK_OUT',time:'06:00:00',timestamp:'2026-10-01T06:00:00+07:00',rawStatus:'VALID'},
  {id:'3',type:'CHECK_OUT',time:'07:00:00',timestamp:'2026-10-01T07:00:00+07:00',rawStatus:'VALID',pairingReason:'UNPAIRED_CHECK_OUT'},
];
const item = { workingHours:8,needsReview:false,rawEvents:events,reasonLabels:{OFF:'Ngày OFF, không tự ghi công'},validIntervals:[{inId:'1',outId:'2',counted:true,inTime:'22:00:00',outTime:'06:00:00',durationStr:'08:00:00',regularSeconds:28800,overtimeSeconds:0,creditedRegularSeconds:28800,creditReason:'HALF_SHIFT_REACHED'}] } as AttendancePairItem;
describe('Attendance details and per-item review', () => {
  it('shows actual time first as the sum of displayed pairs, including uncredited pairs', async () => {
    const pairs = [
      {...item.validIntervals[0], durationStr:'00:01:02', durationSeconds:62.079, counted:true},
      {...item.validIntervals[0], inId:'4', outId:'5', durationStr:'00:05:18', durationSeconds:318.949, counted:false},
    ];
    const rawEvents = [...events, {...events[0],id:'4'}, {...events[1],id:'5'}];
    await mount(<AttendanceDayDetails item={{...item,workingHours:0,rawEvents,validIntervals:pairs}}/>);
    const statistics = () => host.querySelector('td[rowspan="' + host.querySelectorAll('tbody tr').length + '"]:last-child');
    expect(statistics()?.textContent).toMatch(/^Thời gian làm thực:00:06:20Giờ làm:00:00:00/);
    await filter('COUNTED');
    expect(statistics()?.textContent).toMatch(/^Thời gian làm thực:00:01:02Giờ làm:00:00:00/);
  });
  it('filters loose scans while retaining both ends of counted overnight pairs and checkout hours', async () => {
    await mount(<AttendanceDayDetails item={item}/>);
    expect(host.textContent).toContain('07:00:00');expect(host.textContent).toContain('2026-10-01');
    expect(host.textContent).toContain('Thời lượng cặp: 08:00:00');expect(host.textContent).toContain('Giờ làm:08:00:00');
    await filter('COUNTED');
    expect(host.textContent).not.toContain('07:00:00');expect(host.textContent).toContain('22:00:00');expect(host.textContent).toContain('06:00:00');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('excludes a matched pair that fails the half-shift rule from the counted-only filter', async () => {
    await mount(<AttendanceDayDetails item={{...item,workingHours:0,validIntervals:item.validIntervals.map(p=>({...p,counted:false,regularSeconds:0,creditedRegularSeconds:0,creditReason:'UNDER_HALF_SHIFT'}))}}/>);
    await filter('COUNTED');
    expect(host.textContent).toContain('Không có dữ liệu checkin / checkout trong ca làm việc');
  });
  it('shows adjustments without a review column', async () => {
    vi.mocked(apiFetch).mockResolvedValue({success:true,data:[
      {id:'11',employee_id:'NV1',employee_name:'Nhân viên 1',date:'2026-10-01',kind:'OVERTIME',hours:1,amount:100000,status:'PENDING',note:'Đã làm thêm',updated_at:'2026-10-02T00:00:00.000Z',can_review:true},
      {id:'12',employee_id:'NV1',employee_name:'Nhân viên 1',date:'2026-10-02',kind:'ABSENCE',hours:8,amount:200000,status:'PENDING',note:null,updated_at:'2026-10-02T00:00:00.000Z',can_review:true},
    ]} as any);
    await mount(<AdjustmentReviewPanel period="2026-10" workShifts={[{ employee_id:'NV1', date:'2026-10-01', shift_type:'MORNING', start_time:'08:00', end_time:'12:00' } as WorkShift]}/>);await settle();
    const rows=host.querySelectorAll('tbody tr');expect(rows).toHaveLength(2);
    expect(host.textContent).toContain('01/10/2026');
    expect(host.textContent).toContain('Ca sáng');
    expect(host.textContent).toContain('1 giờ');
    expect(host.textContent).toContain('Chưa duyệt');
    expect(host.textContent).not.toContain('Xem xét');
    expect(host.textContent).not.toContain('Xem chi tiết');
    expect(vi.mocked(apiFetch).mock.calls.some(([,options])=>options?.method==='PATCH')).toBe(false);
  });
  it('filters adjustment rows and counts by the selected dates across months', async () => {
    const adjustments = [
      {id:'1', employee_id:'NV1', employee_name:'Test', date:'2026-10-28', kind:'OVERTIME', hours:1, amount:100, status:'APPROVED'},
      {id:'2', employee_id:'NV1', employee_name:'Test', date:'2026-11-05', kind:'OVERTIME', hours:2, amount:200, status:'PENDING'},
    ];
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: adjustments } as any);
    cache.setQueryData(['attendanceAdjustments', 'ALL', 'NV1'], adjustments);
    await mount(<AdjustmentReviewPanel period="ALL" employeeId="NV1" startDate="2026-11-05" endDate="2026-11-05" />);
    expect(host.textContent).toContain('05/11/2026');
    expect(host.textContent).not.toContain('28/10/2026');
    expect(host.textContent).toContain('Chờ duyệt: 1 khoản');
    await mount(<AdjustmentReviewPanel period="ALL" employeeId="NV1" startDate="2026-10-26" endDate="2026-11-05" />);
    expect(host.textContent).toContain('28/10/2026');
    expect(host.textContent).toContain('05/11/2026');
    await mount(<AdjustmentReviewPanel period="ALL" employeeId="NV1" />);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('uses backend overview boundaries instead of unmatched raw scans', async () => {
    const employee={employee_id:'NV1',full_name:'Test',department:'QA',position:'Tester'} as Employee;
    const shift={employee_id:'NV1',date:'2026-09-30',start_time:'22:00',end_time:'06:00',shift_type:'NIGHT'} as WorkShift;
    let result: AttendancePairItem[]=[];
    function Probe() {
      result=useAttendancePairs([employee],[shift],[],'2026-09-30','2026-09-30','','ALL',{}, {},'ALL','ALL',{
        'NV1_2026-09-30':{employee_id:'NV1',date:'2026-09-30',first_check_in:events[0].timestamp,last_check_out:events[1].timestamp,total_working_hours:8,requires_review:true,calculation_details:{events:events.map(e=>({id:e.id,type:e.type,time:e.timestamp,status:'VALID'})),pairs:[{inId:'1',outId:'2',start:events[0].timestamp,end:events[1].timestamp,counted:true,regular_seconds:28800,overtime_seconds:0}]}}
      });return null;
    }
    await mount(<Probe/>);expect(result[0].events.map(e=>e.time)).toEqual(['22:00:00','06:00:00']);expect(result[0].rawEvents).toHaveLength(3);expect(result[0].needsReview).toBe(true);
  });
  it('shows matched pairs even when they do not earn half-shift wages', async () => {
    await mount(<AttendanceDayDetails item={{...item,workingHours:0,validIntervals:item.validIntervals.map(p=>({...p,counted:false,regularSeconds:0,creditedRegularSeconds:0,creditReason:'OFF'}))}}/>);
    await filter('MATCHED');expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(host.textContent).toContain('Đã ghép cặp');expect(host.textContent).toContain('Chưa đạt ngưỡng 2/3 ca');
  });
  it('never labels a positive legacy day as uncredited when per-pair fields are missing', async () => {
    await mount(<AttendanceDayDetails item={{...item,workingHours:10,validIntervals:item.validIntervals.map(p=>({...p,counted:undefined,regularSeconds:undefined,creditedRegularSeconds:undefined}))}}/>);
    expect(host.textContent).toContain('Giờ làm:10:00:00');expect(host.textContent).not.toContain('Chưa tính công');
  });

  it('keeps freshly arrived raw logs visible when the saved summary has no events yet', async () => {
    let rows: AttendancePairItem[]=[];
    function Probe() {
      rows=useAttendancePairs([{employee_id:'NV1',full_name:'Test',department:'QA',position:'Tester'} as Employee],
        [{employee_id:'NV1',date:'2026-10-26',start_time:'08:00',end_time:'18:00',shift_type:'OFFICE_HOURS'} as WorkShift],
        [{id:'100',attendance_id:'ATT-100',employee_id:'NV1',timestamp:'2026-10-26T08:00:00+07:00',type:'CHECK_IN',status:'VALID',method:'FACE',device_id:'PI',verification_score:null}],
        '2026-10-26','2026-10-26','','ALL',{}, {},'ALL','ALL',{'NV1_2026-10-26':{employee_id:'NV1',date:'2026-10-26',calculation_details:{events:[],pairs:[]}}});
      return null;
    }
    await mount(<Probe/>);expect(rows[0].rawEvents.map(e=>e.id)).toEqual(['100']);
    expect(rows[0].validIntervals).toHaveLength(0);expect(rows[0].workingHours).toBe(0);
  });

  it('keeps rule-calculated seconds separate from manually adjusted values', async () => {
    let rows: AttendancePairItem[]=[];
    function Probe() {
      rows=useAttendancePairs([{employee_id:'NV1',full_name:'Test',department:'QA',position:'Tester'} as Employee],
        [{employee_id:'NV1',date:'2026-10-26',start_time:'08:00',end_time:'18:00',shift_type:'OFFICE_HOURS'} as WorkShift], [],
        '2026-10-26','2026-10-26','','ALL',{'NV1_2026-10-26':7200},{'NV1_2026-10-26':1800},'ALL','ALL',{'NV1_2026-10-26':{employee_id:'NV1',date:'2026-10-26',late_early:0.5,overtime:2,late_early_seconds:900,overtime_seconds:2700}});
      return null;
    }
    await mount(<Probe/>);
    expect(rows[0].initialLateEarlySec).toBe(900); expect(rows[0].currentLateEarlySec).toBe(1800);
    expect(rows[0].initialOTSec).toBe(2700); expect(rows[0].currentOTSec).toBe(7200);
  });

  it('shows an unpaired valid check-in in the overview without inventing a checkout or work hours', async () => {
    let rows: AttendancePairItem[]=[];
    function Probe() {
      rows=useAttendancePairs([{employee_id:'NV1',full_name:'Test',department:'QA',position:'Tester'} as Employee],
        [{employee_id:'NV1',date:'2026-10-31',start_time:'08:00',end_time:'18:00',shift_type:'OFFICE_HOURS'} as WorkShift],
        [{id:'100',attendance_id:'ATT-100',employee_id:'NV1',timestamp:'2026-10-31T07:50:05+07:00',type:'CHECK_IN',status:'VALID',method:'FACE',device_id:'PI',verification_score:0.94,punctuality:'ON_TIME'}],
        '2026-10-31','2026-10-31','','ALL',{}, {},'ALL','ALL',{'NV1_2026-10-31':{employee_id:'NV1',date:'2026-10-31',first_check_in:null,last_check_out:null,total_working_hours:0,requires_review:true,calculation_details:{events:[{id:'100',type:'CHECK_IN',time:'2026-10-31T07:50:05+07:00',status:'VALID',method:'FACE'}],pairs:[]}}});
      return null;
    }
    await mount(<Probe/>);
    expect(rows[0].events[0].time).toBe('07:50:05');
    expect(rows[0].events[0].status).toBe('ON_TIME');
    expect(rows[0].events[1].time).toBe('--:--:--');
    expect(rows[0].workingHours).toBe(0);
    expect(rows[0].needsReview).toBe(true);
  });

  it('shows an unpaired check-out in the overview with actual checkout time and displays red warning in details', async () => {
    let rows: AttendancePairItem[]=[];
    const checkoutScan = {id:'200',attendance_id:'ATT-200',employee_id:'NV1',timestamp:'2026-10-29T17:10:55+07:00',type:'CHECK_OUT',status:'VALID',method:'FACE',device_id:'GATE-01',verification_score:0.95,punctuality:'ON_TIME'};
    function Probe() {
      rows=useAttendancePairs([{employee_id:'NV1',full_name:'Khôi',department:'IT',position:'Dev'} as Employee],
        [{employee_id:'NV1',date:'2026-10-29',start_time:'08:00',end_time:'17:00',shift_type:'OFFICE_HOURS'} as WorkShift],
        [checkoutScan],
        '2026-10-29','2026-10-29','','ALL',{}, {},'ALL','ALL',{'NV1_2026-10-29':{employee_id:'NV1',date:'2026-10-29',first_check_in:null,last_check_out:null,total_working_hours:0,requires_review:true,review_reason:'UNPAIRED_CHECK_OUT',calculation_details:{events:[{id:'200',type:'CHECK_OUT',time:'2026-10-29T17:10:55+07:00',status:'VALID',method:'FACE'}],pairs:[],ignored:[{id:'200',reason:'UNPAIRED_CHECK_OUT'}]}}});
      return null;
    }
    await mount(<Probe/>);
    expect(rows[0].events[0].time).toBe('--:--:--');
    expect(rows[0].events[1].time).toBe('17:10:55');
    expect(rows[0].events[1].methodLabel).toBe('Face-id');
    expect(rows[0].events[1].device_id).toBe('GATE-01');

    await mount(<AttendanceDayDetails item={rows[0]}/>);
    const pairingCell = Array.from(host.querySelectorAll('td')).find(td => td.textContent?.includes('Thiếu check-in cho lượt check-out'));
    expect(pairingCell).toBeTruthy();
    expect(pairingCell?.className).toContain('text-rose-600');
  });

});
