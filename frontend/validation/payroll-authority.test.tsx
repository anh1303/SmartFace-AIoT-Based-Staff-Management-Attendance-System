import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Employee, PayrollRecord } from '../src/types';

const state = vi.hoisted(() => ({ payroll: [] as PayrollRecord[], bonusPenalty: null, role: 'manager' }));
vi.mock('../src/context/AppContext', () => ({ useApp: () => state }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ role: state.role }) }));
import { useEmployeePayrollDetail } from '../src/features/payrolls/hooks/useEmployeePayrollDetail';
import { PayslipBreakdown } from '../src/features/payrolls/components/PayslipBreakdown';
import { PayrollSummaryCards } from '../src/features/payrolls/components/PayrollSummaryCards';
import { AttendanceHeader } from '../src/features/attendances/components/AttendanceHeader';
import { ManagerDevices } from '../src/pages/manager/ManagerDevices';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../src/context/ToastContext';
import { WebRTCPlayer } from '../src/features/attendances/components/WebRTCPlayer';
import { AdjustmentReviewPanel, canReviewAdjustment, type AttendanceAdjustment } from '../src/features/payrolls/components/AdjustmentReviewPanel';

const employee = { employee_id: 'NV01', hourly_rate: 90000 } as Employee;
const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const record = {
  payroll_id: 'p1', employee_id: 'NV01', period: currentPeriod, hourly_rate: 90000,
  total_working_hours: 8, total_overtime: 2, total_late_early: 1, allowance: 40000,
  net_salary: 0, status: 'PENDING',
  breakdown: { base_salary: 123, overtime_pay: 456, late_early_deduction: 78, absence_deduction: 9, allowance: 40, net_salary: 0 },
} as PayrollRecord;

function derive() {
  let result: ReturnType<typeof useEmployeePayrollDetail>;
  function Probe() {
    result = useEmployeePayrollDetail({ currentEmp: employee, workDays: 20, lateCount: 8 });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result!;
}

describe('Payroll source of truth', () => {
  beforeEach(() => { state.payroll = []; });
  it('leaves the current period uncalculated when only an older payroll exists', () => {
    state.payroll = [{ ...record, period: '2020-01', net_salary: 123456 }];
    const result = derive();
    expect(result.currentMonthPayroll).toBeNull();
    expect(result.currentNetSalary).toBeNull();
    expect(result.standardHours).toBe(0);
    expect(result.lateEarlyHours).toBe(0);
  });
  it('does not estimate missing payroll from workday or late counts', () => {
    const result = derive();
    expect(result.currentNetSalary).toBeNull();
    expect(result.standardHours).toBe(0);
    expect(result.lateEarlyHours).toBe(0);
  });
  it('preserves a zero salary and consumes the server breakdown', () => {
    state.payroll = [record];
    const result = derive();
    expect(result.currentNetSalary).toBe(0);
    expect(result.baseSalary).toBe(123);
    expect(result.otAmount).toBe(456);
    expect(result.penaltyAmount).toBe(87);
  });
  it('renders backend monetary rows and reconciliation state without recomputing amounts', () => {
    const html = renderToStaticMarkup(<PayslipBreakdown record={{ ...record, requires_reconciliation: true, needs_recalculation: true }} otRate={999999} penaltyRate={999999} />);
    expect(html).toContain('123 ₫');
    expect(html).toContain('456 ₫');
    expect(html).toContain('Cần đối soát');
    expect(html).toContain('Cần tính lại');
    expect(html).not.toContain('720.000');
  });
  it('does not fabricate a breakdown for a legacy payroll with unknown snapshot', () => {
    const html = renderToStaticMarkup(<PayslipBreakdown record={{ ...record, breakdown: null }} otRate={999999} penaltyRate={999999} />);
    expect(html).toContain('Chưa có chi tiết tính lương');
    expect(html).not.toContain('720.000');
    expect(html).toContain('0 ₫');
  });
  it('labels explicit fixed rates and zero without guessing multiplier units', () => {
    const html = renderToStaticMarkup(<PayrollSummaryCards bonusPenalty={{ overtime_rate: 5, overtime_rate_kind: 'FIXED_PER_HOUR', late_early_penalty: 0, late_early_penalty_kind: 'FIXED_PER_HOUR' }} allPeriodRecords={[]} totalExpense={0} isFinalized={false} onOpenPolicyModal={() => {}} />);
    expect(html).toContain('5 ₫/h');
    expect(html).toContain('0 ₫/h');
    expect(html).not.toContain('5x');
    expect(html).not.toContain('50.000');
  });
  it('does not offer global attendance lock controls to managers', () => {
    const html = renderToStaticMarkup(<AttendanceHeader startDate="2026-10-29" endDate="2026-10-29" isCurrentDateLocked={false} onToggleLock={() => {}} onExportCSV={() => {}} />);
    expect(html).not.toContain('Chốt ca');
  });
  it('does not offer shared device management to managers', () => {
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ToastProvider><ManagerDevices/></ToastProvider></QueryClientProvider></MemoryRouter>);
    expect(html).not.toContain('Thêm thiết bị');
    expect(html).toContain('Chỉ Admin');
  });
  it('does not expose shared camera or mode controls to managers', () => {
    expect(renderToStaticMarkup(<WebRTCPlayer/>)).toBe('');
  });
  it('shows unknown adjustment prices and excludes them from known pending totals', () => {
    const adjustment: AttendanceAdjustment = { id: 'a1', employee_id: 'NV01', employee_name: 'Test', date: '2026-10-29', kind: 'ABSENCE', hours: 8, amount: null, amount_unavailable: true, status: 'PENDING', note: null, reviewed_by: null, reviewed_at: null, updated_at: '2026-10-29T00:00:00Z', can_review: false };
    const client = new QueryClient();
    client.setQueryData(['attendanceAdjustments', '2026-10', 'ALL'], [adjustment, { ...adjustment, id: 'a2', amount: 123, amount_unavailable: false }]);
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><ToastProvider><AdjustmentReviewPanel period="2026-10"/></ToastProvider></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('Chưa có đơn giá đối chiếu');
    expect(html).toContain('123 ₫');
    expect(html).toContain('1 khoản chưa xác định số tiền');
    expect(canReviewAdjustment({ ...adjustment, can_review: true })).toBe(false);
  });
});
