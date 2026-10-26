// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttendanceDayDetails } from '../src/features/attendances/components/AttendanceDayDetails';
import { AdjustmentReviewPanel } from '../src/features/payrolls/components/AdjustmentReviewPanel';
import { useAttendancePairs } from '../src/features/attendances/hooks/useAttendancePairs';
import type { AttendancePairItem } from '../src/features/attendances/hooks/useAttendancePairs';
import type { Employee, WorkShift } from '../src/types';
vi.mock('../src/api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({showToast:vi.fn()}) }));
import { apiFetch } from '../src/api/client';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, cache: QueryClient;
beforeEach(() => { host=document.createElement('div');document.body.append(host);root=createRoot(host);cache=new QueryClient({defaultOptions:{queries:{retry:false}}});vi.clearAllMocks(); });
afterEach(async () => {await act(async()=>root.unmount());host.remove();cache.clear();});
const mount = async (component: React.ReactNode) => { await act(async()=> { root.render(<QueryClientProvider client={cache}>{component}</QueryClientProvider>); }); };
const click = async (element: Element | null) => { expect(element).toBeTruthy();await act(async()=>{(element as HTMLElement).click();}); };
const filter = async (value: string) => { await act(async () => { const select=host.querySelector('select[aria-label="Lọc lượt chấm công"]') as HTMLSelectElement; select.value=value;select.dispatchEvent(new Event('change',{bubbles:true})); }); };
const settle = async () => { await act(async()=>{await new Promise(r=>setTimeout(r,10));}); };
const events = [
  {id:'1',type:'CHECK_IN',time:'22:00:00',timestamp:'2026-09-30T22:00:00+07:00',rawStatus:'VALID'},
  {id:'2',type:'CHECK_OUT',time:'06:00:00',timestamp:'2026-10-01T06:00:00+07:00',rawStatus:'VALID'},
  {id:'3',type:'CHECK_OUT',time:'07:00:00',timestamp:'2026-10-01T07:00:00+07:00',rawStatus:'VALID',pairingReason:'UNPAIRED_CHECK_OUT'},
];
const item = { workingHours:8,needsReview:false,rawEvents:events,validIntervals:[{inId:'1',outId:'2',counted:true,inTime:'22:00:00',outTime:'06:00:00',durationStr:'08:00:00',regularSeconds:28800,overtimeSeconds:0,creditedRegularSeconds:28800,creditReason:'HALF_SHIFT_REACHED'}] } as AttendancePairItem;
describe('Attendance details and per-item review', () => {
  it('filters loose scans while retaining both ends of counted overnight pairs and checkout hours', async () => {
    await mount(<AttendanceDayDetails item={item}/>);
    expect(host.textContent).toContain('07:00:00');expect(host.textContent).toContain('2026-10-01');
    expect(host.textContent).toContain('08:00:00 trong ca');expect(host.textContent).toContain('Công ghi nhận: +08:00:00');
    await filter('COUNTED');
    expect(host.textContent).not.toContain('07:00:00');expect(host.textContent).toContain('22:00:00');expect(host.textContent).toContain('06:00:00');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('excludes a matched pair that fails the half-shift rule from the counted-only filter', async () => {
    await mount(<AttendanceDayDetails item={{...item,workingHours:0,validIntervals:item.validIntervals.map(p=>({...p,counted:false,regularSeconds:0,creditedRegularSeconds:0,creditReason:'UNDER_HALF_SHIFT'}))}}/>);
    await filter('COUNTED');expect(host.querySelectorAll('tbody tr')).toHaveLength(0);
  });
  it('opens totals and reviews just the selected dated item', async () => {
    vi.mocked(apiFetch).mockResolvedValue({success:true,data:[
      {id:'11',employee_id:'NV1',employee_name:'Nhân viên 1',date:'2026-10-01',kind:'OVERTIME',hours:1,amount:100000,status:'PENDING',note:'Đã làm thêm',updated_at:'2026-10-02T00:00:00.000Z',can_review:true},
      {id:'12',employee_id:'NV1',employee_name:'Nhân viên 1',date:'2026-10-02',kind:'ABSENCE',hours:8,amount:200000,status:'PENDING',note:null,updated_at:'2026-10-02T00:00:00.000Z',can_review:true},
    ]} as any);
    await mount(<AdjustmentReviewPanel period="2026-10"/>);await settle();
    await click(host.querySelector('button[aria-expanded]'));
    const rows=host.querySelectorAll('tbody tr');expect(rows).toHaveLength(2);
    const first=rows[0];await click(first.querySelector('button'));await settle();
    const patch=vi.mocked(apiFetch).mock.calls.find(([url,options])=>url==='/api/payroll/adjustments/11' && options?.method==='PATCH');
    expect(patch).toBeTruthy();expect(JSON.parse(patch![1]!.body as string)).toEqual({status:'APPROVED',note:'Đã làm thêm',updated_at:'2026-10-02T00:00:00.000Z'});
    expect(vi.mocked(apiFetch).mock.calls.some(([url,options])=>url==='/api/payroll/adjustments/12'&&options?.method==='PATCH')).toBe(false);
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
    expect(host.textContent).toContain('Đã ghép cặp');expect(host.textContent).toContain('Công ghi nhận: +00:00:00');expect(host.textContent).toContain('Ngày OFF');
  });
  it('never labels a positive legacy day as uncredited when per-pair fields are missing', async () => {
    await mount(<AttendanceDayDetails item={{...item,workingHours:10,validIntervals:item.validIntervals.map(p=>({...p,counted:undefined,regularSeconds:undefined,creditedRegularSeconds:undefined}))}}/>);
    expect(host.textContent).toContain('công ngày đã ghi 10h');expect(host.textContent).not.toContain('Chưa tính công');
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

});
