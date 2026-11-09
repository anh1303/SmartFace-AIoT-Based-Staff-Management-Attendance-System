import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PayrollTable } from '../../src/features/payrolls/components/PayrollTable';
import type { PayrollRecord } from '../../src/types';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin', currentUser: null }) }));

describe('payroll table hours', () => {
  it('shows saved payroll hours even when attendance contains a short uncredited scan', () => {
    const record = { payroll_id: '1', employee_id: 'NV-019', employee_name: 'Nhân viên', total_working_hours: 0, total_overtime: 0, total_late_early: 0, hourly_rate: 50000, allowance: 1500000, net_salary: 1500000, status: 'PENDING' } as PayrollRecord;
    const html = renderToStaticMarkup(<PayrollTable selectedPeriod="2026-10" currentRecords={[record]} allPeriodRecords={[record]} employees={[]} searchTerm="" onSearchChange={() => {}} departmentFilter="ALL" onDepartmentFilterChange={() => {}} isFinalized={false} onOpenEdit={() => {}}/>);
    expect(html).toContain('>0 giờ</td>');
    expect(html).not.toContain('0,01 giờ');
  });

  it('uses the payroll snapshot count and does not invent a value when it is missing', () => {
    const record = { payroll_id: '2', employee_id: 'NV-021', employee_name: 'Nguyễn Quang Lâm', total_working_hours: 0, total_overtime: 0, total_late_early: 0, hourly_rate: 80000, allowance: 0, net_salary: 0, status: 'PENDING' } as PayrollRecord;
    const props = { selectedPeriod: '2026-10', currentRecords: [record], allPeriodRecords: [record], employees: [], searchTerm: '', onSearchChange: () => {}, departmentFilter: 'ALL', onDepartmentFilterChange: () => {}, isFinalized: false, onOpenEdit: () => {} };
    expect(renderToStaticMarkup(<PayrollTable {...props}/>)).toContain('Chưa có dữ liệu');
    expect(renderToStaticMarkup(<PayrollTable {...props} currentRecords={[{ ...record, approved_absence_count: 2 }]}/>)).toContain('>2 ca</td>');
  });
});
