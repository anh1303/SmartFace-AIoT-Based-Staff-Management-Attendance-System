import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

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
    const html = renderToStaticMarkup(<EmployeeDashboard />);
    expect(html).toContain('Chưa có lượt quẹt hôm nay');
    expect(html).not.toContain('AI Face Recognition Node 01');
    expect(html).not.toContain('Đã đăng ký 3 góc');
    expect(html).not.toContain('2 NGÓN TRỎ');
    expect(html).not.toContain('T9');
  });
});
