import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '@/features/employees';
import type { PayrollRecord } from '@/features/payrolls';

const state = vi.hoisted(() => ({
  payroll: [] as PayrollRecord[],
  employees: [] as Employee[],
  bonusPenalty: null,
  role: 'manager',
  currentUser: { employee_id: 'MGR01', department: 'IT', email: 'mgr@company.vn' } as any,
  selectedPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  setSelectedPeriod: vi.fn(),
  generatePayroll: vi.fn(),
  updatePayrollItem: vi.fn(),
  finalizePayrollPeriod: vi.fn(),
  unlockPayrollPeriod: vi.fn(),
  updateBonusPenalty: vi.fn(),
}));
vi.mock('../../src/context/AppContext', () => ({ useApp: () => state }));
vi.mock('../../src/features/payrolls/context/PayrollContext', () => ({ usePayrollContext: () => state }));
vi.mock('../../src/features/employees/context/EmployeeContext', () => ({ useEmployeeContext: () => ({ employees: state.employees }) }));
vi.mock('../../src/features/payrolls/hooks/usePayrollHistory', () => ({ usePayrollHistory: () => ({ data: state.payroll, isLoading: false, error: null }) }));
vi.mock('../../src/features/auth/context/AuthContext', () => ({ useAuth: () => ({ role: state.role, currentUser: state.currentUser }) }));
import { useEmployeePayrollDetail } from '../../src/features/payrolls/hooks/useEmployeePayrollDetail';
import { PayslipBreakdown } from '../../src/features/payrolls/components/PayslipBreakdown';
import { PayrollSummaryCards } from '../../src/features/payrolls/components/PayrollSummaryCards';
import { AttendanceHeader } from '../../src/features/attendances/components/AttendanceHeader';
import { ManagerDevices } from '../../src/pages/manager/ManagerDevices';
import { ManagerPayroll } from '../../src/pages/manager/ManagerPayroll';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../src/context/ToastContext';
import { WebRTCPlayer } from '../../src/features/attendances/components/WebRTCPlayer';
import { AdjustmentReviewPanel, canReviewAdjustment, type AttendanceAdjustment } from '../../src/features/payrolls/components/AdjustmentReviewPanel';

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
  it('labels multiplier rates without guessing fixed units', () => {
    const html = renderToStaticMarkup(<PayrollSummaryCards bonusPenalty={{ overtime_rate: 2.0, late_early_penalty: 1.5 }} allPeriodRecords={[]} totalExpense={0} isFinalized={false} onOpenPolicyModal={() => {}} />);
    expect(html).toContain('2x');
    expect(html).toContain('1.5x');
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
  it('shows unknown adjustment prices and counts pending items', () => {
    const adjustment: AttendanceAdjustment = { id: 'a1', employee_id: 'NV01', employee_name: 'Test', date: '2026-10-29', kind: 'ABSENCE', hours: 8, amount: null, amount_unavailable: true, status: 'PENDING', note: null, reviewed_by: null, reviewed_at: null, updated_at: '2026-10-29T00:00:00Z', can_review: false };
    const client = new QueryClient();
    client.setQueryData(['attendanceAdjustments', '2026-10', 'ALL'], [adjustment, { ...adjustment, id: 'a2', amount: 123, amount_unavailable: false }]);
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><ToastProvider><AdjustmentReviewPanel period="2026-10"/></ToastProvider></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('Chưa có đơn giá đối chiếu');
    expect(html).toContain('123 ₫');
    expect(html).toContain('2 khoản');
    expect(canReviewAdjustment({ ...adjustment, can_review: true })).toBe(false);
  });

  it('displays the exact API payroll scope even before employees load and gates row editing strictly by backend can_edit', () => {
    const managerRecord = {
      ...record,
      id: '1',
      payroll_id: 'PR-202611-001',
      employee_id: 'MGR01',
      employee_name: 'Manager Self',
      department: 'IT',
      status: 'PENDING',
      can_edit: false,
    } as PayrollRecord;
    const subordinateRecord = {
      ...record,
      id: '2',
      payroll_id: 'PR-202611-002',
      employee_id: 'EMP01',
      employee_name: 'Subordinate One',
      department: 'IT',
      status: 'PENDING',
      can_edit: true,
    } as PayrollRecord;
    const transferredRecord = {
      ...record,
      id: '3',
      payroll_id: 'PR-202611-003',
      employee_id: 'EMP02',
      employee_name: 'Moved Department',
      department: 'IT',
      status: 'PENDING',
      can_edit: false,
    } as PayrollRecord;

    state.payroll = [managerRecord, subordinateRecord, transferredRecord];
    state.employees = []; // Employees not loaded yet!

    const htmlWithoutEmployees = renderToStaticMarkup(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <ManagerPayroll />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(htmlWithoutEmployees).toContain('MGR01');
    expect(htmlWithoutEmployees).toContain('EMP01');
    expect(htmlWithoutEmployees).toContain('EMP02');

    // Now load employees with stale/mismatched department or email: displayed set and editability must remain identical
    state.employees = [
      { id: 'u1', employee_id: 'MGR01', full_name: 'Manager Self', department: 'IT', email: 'different@company.vn' } as Employee,
      { id: 'u2', employee_id: 'EMP01', full_name: 'Subordinate One', department: 'HR' } as Employee,
      { id: 'u3', employee_id: 'EMP02', full_name: 'Moved Department', department: 'IT' } as Employee,
    ];

    const htmlWithEmployees = renderToStaticMarkup(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <ManagerPayroll />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(htmlWithEmployees).toContain('MGR01');
    expect(htmlWithEmployees).toContain('EMP01');
    expect(htmlWithEmployees).toContain('EMP02');

    // Exactly 1 record (EMP01 with can_edit: true) has an enabled "Sửa" button; the 2 with can_edit: false are disabled
    const editBtnRegex = /<button[^>]*>(?:(?!<\/button>)[^])*?Sửa<\/button>/g;
    const editButtonsWithoutEmp = [...htmlWithoutEmployees.matchAll(editBtnRegex)].map(m => m[0]);
    const editButtonsWithEmp = [...htmlWithEmployees.matchAll(editBtnRegex)].map(m => m[0]);
    expect(editButtonsWithoutEmp).toHaveLength(3);
    expect(editButtonsWithoutEmp.filter(btn => !btn.includes('disabled'))).toHaveLength(1);
    expect(editButtonsWithEmp.filter(btn => !btn.includes('disabled'))).toHaveLength(1);
  });
});
