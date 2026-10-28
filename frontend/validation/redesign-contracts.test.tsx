import {templateAssignment} from '../src/features/schedules/components/ShiftTemplates';
// @vitest-environment jsdom
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {validDeviceIp} from '../src/features/devices/deviceApi';
import {confirmsRequestedMode} from '../src/features/devices/deviceModeState';
import {canReviewAdjustment,filterAdjustments,type AttendanceAdjustment} from '../src/features/payrolls/components/AdjustmentReviewPanel';
import {PayslipBreakdown} from '../src/features/payrolls/components/PayslipBreakdown';
import {attendanceEventLabel} from '../src/components/common/AttendanceEventBadge';
import type {PayrollRecord} from '../src/types';
const item:AttendanceAdjustment={id:'a1',employee_id:'NV1',employee_name:'Nguyễn Minh An',date:'2026-10-28',kind:'OVERTIME',hours:1,amount:100000,status:'PENDING',note:null,reviewed_by:null,reviewed_at:null,updated_at:'2026-10-28T01:00:00Z',can_review:true};
describe('device registration and truthful ACKs',()=>{
 it('allows optional blank IP and IPv4/IPv6, rejects URLs and invalid octets',()=>{for(const ip of ['', '192.168.1.10','::1','2001:db8::1'])expect(validDeviceIp(ip),ip).toBe(true);for(const ip of ['999.1.1.1','01.2.3.4','http://192.168.1.1','192.168.1','hello','1:2:3'])expect(validDeviceIp(ip),ip).toBe(false);});
 it('never confirms from a pending response, old cache, missing time, or a different mode',()=>{const requested={mode:'CHECK_OUT' as const,time:Date.parse('2026-10-28T02:00:00Z')};expect(confirmsRequestedMode({deviceId:'pi',mode:'CHECK_OUT',confirmed:false,lastUpdated:'2026-10-28T02:01:00Z'},requested)).toBe(false);expect(confirmsRequestedMode({deviceId:'pi',mode:'CHECK_OUT',confirmed:true,lastUpdated:'2026-10-28T01:59:00Z'},requested)).toBe(false);expect(confirmsRequestedMode({deviceId:'pi',mode:'CHECK_OUT',confirmed:true},requested)).toBe(false);expect(confirmsRequestedMode({deviceId:'pi',mode:'CHECK_IN',confirmed:true,lastUpdated:'2026-10-28T02:01:00Z'},requested)).toBe(false);expect(confirmsRequestedMode({deviceId:'pi',mode:'CHECK_OUT',confirmed:true,lastUpdated:'2026-10-28T02:01:00Z'},requested)).toBe(true);});
});
describe('dated review and payslip evidence',()=>{
 it('respects backend review permission, lock and void state',()=>{expect(canReviewAdjustment(item)).toBe(true);expect(canReviewAdjustment({...item,can_review:false})).toBe(false);expect(canReviewAdjustment({...item,locked:true})).toBe(false);expect(canReviewAdjustment({...item,status:'VOID'})).toBe(false);});
 it('combines review filters without changing the source ledger',()=>{const items=[item,{...item,id:'a2',kind:'ABSENCE' as const,status:'APPROVED' as const}];expect(filterAdjustments(items,'PENDING','OVERTIME','minh')).toEqual([item]);expect(filterAdjustments(items,'ALL','ABSENCE','2026-10-28')).toHaveLength(1);expect(items).toHaveLength(2);});
 it('uses stored rates and shows absence deduction separately while retaining backend net salary',()=>{const record:PayrollRecord={payroll_id:'p',employee_id:'NV1',period:'2026-10',hourly_rate:50000,total_working_hours:8,total_overtime:2,total_late_early:1,total_absence_penalty:100000,allowance:300000,net_salary:777777,status:'PAID',overtime_rate:100000,late_penalty_rate:50000};const html=renderToStaticMarkup(<PayslipBreakdown record={record} otRate={999999} penaltyRate={888888}/>);expect(html).toContain('200.000');expect(html).toContain('-50.000');expect(html).toContain('Phạt vắng ca đã duyệt');expect(html).toContain('-100.000');expect(html).toContain('777.777');});
});

describe('attendance event meaning',()=>{it('distinguishes incoming, outgoing including legacy exits, and unknown events',()=>{expect(attendanceEventLabel('CHECK_IN')).toBe('Vào ca');expect(attendanceEventLabel('CHECK_OUT')).toBe('Ra ca');expect(attendanceEventLabel('TAN_CA')).toBe('Ra ca');expect(attendanceEventLabel('UNRECOGNIZED')).toBe('Chưa xác định');});});


describe('custom shift template application',()=>{it('copies reusable hours into the existing OTHER contract and retains the named context without mutating the template',()=>{const template={id:'t1',name:'Ca hỗ trợ tối',start_time:'18:00',end_time:'22:00',note:'Cửa hàng A'};expect(templateAssignment(template)).toEqual({shift_type:'OTHER',start_time:'18:00',end_time:'22:00',note:'Ca hỗ trợ tối · Cửa hàng A'});expect(template.id).toBe('t1');});});
