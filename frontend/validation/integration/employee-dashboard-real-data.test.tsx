import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/context/ShiftContext', () => ({ useShiftContext: () => ({ workShifts: [], isLoading: false, isError: false }) }));
vi.mock('../../src/features/attendances/hooks/useEmployeeOverview', () => ({ useEmployeeOverview: () => ({ data: { period: '2026-11', through_date: '2026-11-06', work_days: null, working_hours: null, overtime_hours: null, late_early_hours: null, absent_days: null, today: [] }, isPending: false, isError: false }) }));

vi.mock('../../src/context/AppContext', () => ({ useApp: () => ({
  currentUser: { employee_id: 'E1', full_name: 'Test' },
  employees: [{ employee_id: 'E1', full_name: 'Test', face_enrolled: false, fingerprint_enrolled: false }],
  workShifts: [{ employee_id: 'E1', date: '2020-01-01', shift_type: 'MORNING', start_time: '08:00', end_time: '12:00' }],
  attendance: [{ employee_id: 'E1', timestamp: '2020-01-01T01:00:00Z', type: 'CHECK_IN', status: 'VALID' }],
  payroll: [], bonusPenalty: [], showToast: vi.fn(),
}) }));
import { EmployeeDashboard } from '../../src/pages/employee/EmployeeDashboard';

describe('employee dashboard missing data', () => {
  it('does not present past activity or invented biometrics as today’s data', () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><EmployeeDashboard /></QueryClientProvider>);
    expect(html).toContain('Chưa có lượt quẹt hôm nay');
    expect(html).not.toContain('AI Face Recognition Node 01');
    expect(html).not.toContain('Đã đăng ký 3 góc');
    expect(html).not.toContain('2 NGÓN TRỎ');
    expect(html).not.toContain('T9');
    expect(html).toContain('Công tháng này');
    expect(html).toContain('Nghỉ làm không lý do');
    expect(html).toContain('Chưa có dữ liệu lương kỳ hiện tại');
    expect(html).not.toContain('Soạn giải trình');
    expect(html).not.toContain('0 ngày');
    expect(html).not.toContain('0 giờ');
  });
});

vi.mock('../../src/context/EmployeeContext', async () => { const app = await import('../../src/context/AppContext'); return { useEmployeeContext: () => app.useApp() }; });
vi.mock('../../src/context/PayrollContext', async () => { const app = await import('../../src/context/AppContext'); return { usePayrollContext: () => app.useApp() }; });
vi.mock('../../src/context/AuthContext', async () => { const app = await import('../../src/context/AppContext'); return { useAuth: () => app.useApp() }; });
