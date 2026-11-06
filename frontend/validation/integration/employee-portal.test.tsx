// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = vi.hoisted(() => ({
  app: { currentUser: { employee_id: 'E1', full_name: 'Nhân viên A' }, employees: [{ id: 'uuid-1', employee_id: 'E1' }], payroll: [] as any[], isLoadingPayroll: false, payrollError: null },
  shifts: { workShifts: [] as any[], isLoading: false, isError: false, refetchShifts: vi.fn() },
  overview: { data: { period: '2026-11', through_date: '2026-11-06', work_days: 3, working_hours: 24, overtime_hours: 1.5, late_early_hours: 0.5, absent_days: 2, today: [] }, isPending: false, isError: false, fetchStatus: 'idle' },
}));
vi.mock('../../src/context/AppContext', () => ({ useApp: () => state.app }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: state.app.currentUser, role: 'employee' }) }));
vi.mock('../../src/context/ShiftContext', () => ({ useShiftContext: () => state.shifts }));
vi.mock('../../src/features/attendances/hooks/useEmployeeOverview', () => ({ useEmployeeOverview: () => state.overview }));
import { EmployeeDashboard } from '../../src/pages/employee/EmployeeDashboard';
import { EmployeeSchedule } from '../../src/pages/employee/EmployeeSchedule';
import { EmployeeSalaryEstimate } from '../../src/pages/employee/EmployeeSalaryEstimate';
import { EmployeeBiometrics } from '../../src/pages/employee/EmployeeBiometrics';
import { Sidebar } from '../../src/components/layout/Sidebar';

let root: Root | undefined;
let host: HTMLDivElement;
const render = (element: React.ReactNode, client = new QueryClient()) => renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T10:00:00+07:00'));
  state.app.payroll = [];
  state.shifts.workShifts = [
    { shift_id: '1', employee_id: 'E1', date: '2026-11-06', shift_type: 'MORNING', start_time: '08:15', end_time: '11:45', note: 'Đào tạo' },
    { shift_id: '2', employee_id: 'OTHER', date: '2026-11-06', shift_type: 'OTHER', start_time: '00:00', end_time: '01:00', note: 'Thông tin người khác' },
    { shift_id: '3', employee_id: 'uuid-1', date: '2026-11-09', shift_type: 'AFTERNOON', start_time: '13:30', end_time: '17:30' },
  ];
  host = document.createElement('div'); document.body.append(host);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; host.remove(); vi.useRealTimers(); });

describe('employee read-only portal', () => {
  it('offers exactly six employee destinations and preserves the editable account profile destination', () => {
    const html = render(<Sidebar isOpen={false} onClose={() => {}}/>);
    const page = document.createElement('div'); page.innerHTML = html;
    expect([...page.querySelectorAll('nav a')].map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Tổng quan', '/app/employee/dashboard'], ['Lịch làm việc', '/app/employee/schedule'], ['Theo dõi chấm công', '/app/employee/attendance'],
      ['Sinh trắc học', '/app/employee/biometrics'], ['Bảng lương', '/app/employee/payroll'], ['Hồ sơ', '/app/account/profile'],
    ]);
  });
  it('shows backend credited totals and DB shift times rather than counting raw scans or guessing standard hours', () => {
    const html = render(<EmployeeDashboard />);
    expect(html).toContain('3 ngày'); expect(html).toContain('1,5 giờ'); expect(html).toContain('0,5 giờ'); expect(html).toContain('2 ngày');
    expect(html).toContain('08:15 – 11:45'); expect(html).not.toContain('Thông tin người khác');
    expect(html).not.toContain('15.000'); expect(html).not.toContain('Soạn giải trình');
  });
  it('navigates weeks, searches own assignments and selects a day without a shift exchange or edit action', () => {
    root = createRoot(host); act(() => root!.render(<EmployeeSchedule />));
    expect(host.textContent).toContain('Đào tạo'); expect(host.textContent).not.toContain('Thông tin người khác');
    expect(host.textContent).not.toContain('đổi ca');
    act(() => (host.querySelector('[aria-label="Tuần sau"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('13:30 – 17:30'); expect(host.textContent).not.toContain('Đào tạo');
    const search = host.querySelector('input[type="text"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'không tồn tại');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).not.toContain('13:30 – 17:30');
    expect(host.textContent).toContain('Không có ca khớp');
  });
  it('supports a six-week month calendar and month navigation', () => {
    root = createRoot(host); act(() => root!.render(<EmployeeSchedule />));
    act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Tháng')!.click());
    expect(host.querySelectorAll('time')).toHaveLength(42);
    act(() => (host.querySelector('[aria-label="Tháng sau"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('12/2026');
  });
  it('shows an empty payroll without made-up money or export controls', () => {
    const html = render(<EmployeeSalaryEstimate />);
    expect(html).toContain('Bảng lương'); expect(html).toContain('Chưa có dữ liệu bảng lương kỳ này');
    expect(html).not.toContain('15.000'); expect(html).not.toContain('Xuất'); expect(html).not.toContain('In phiếu');
  });
  it('renders saved payroll breakdown and never derives wages from the hourly rate in the browser', () => {
    state.app.payroll = [{ employee_id: 'uuid-1', period: '2026-11', hourly_rate: 110000, total_working_hours: 8, net_salary: 999000, status: 'PENDING', breakdown: { base_salary: 800000, overtime_pay: 50000, late_early_deduction: 1000, absence_deduction: 0, allowance: 150000, net_salary: 999000 } }];
    const html = render(<EmployeeSalaryEstimate />);
    expect(html).toContain('999.000đ'); expect(html).toContain('800.000 ₫'); expect(html).not.toContain('880.000');
  });
  it('selects a stored payroll period through the same dropdown used by admin pages', () => {
    state.app.payroll = [{ employee_id: 'E1', period: '2026-10', net_salary: 1230000, status: 'PAID' }];
    root = createRoot(host); act(() => root!.render(<EmployeeSalaryEstimate />));
    expect(host.textContent).toContain('Chưa có dữ liệu bảng lương kỳ này');
    act(() => (host.querySelector('[role="combobox"][aria-label="Kỳ lương:"]') as HTMLButtonElement).click());
    act(() => ([...host.querySelectorAll('[role="option"]')].find(option => option.textContent === 'Tháng 10/2026') as HTMLElement).click());
    expect(host.textContent).toContain('1.230.000đ');
    expect(host.textContent).toContain('Đã thanh toán');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });
  it('shows only enrolled status from the employee record, without biometric registration actions', () => {
    const client = new QueryClient(); client.setQueryData(['ownEmployeeProfile', 'E1'], { face_enrolled: true, fingerprint_enrolled: false });
    const html = render(<EmployeeBiometrics />, client);
    expect(html).toContain('Đã đăng ký'); expect(html).toContain('Chưa đăng ký');
    expect(html).not.toContain('<button');
  });
});
