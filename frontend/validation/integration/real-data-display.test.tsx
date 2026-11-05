import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportsSummaryKpis } from '../../src/features/reports/components/ReportsSummaryKpis';
import { DashboardRecentLogsTable } from '../../src/features/dashboard/components/DashboardRecentLogsTable';

describe('missing dashboard data', () => {
  it('does not report a perfect punctuality rate when there are no punches', () => {
    const html = renderToStaticMarkup(<ReportsSummaryKpis data={{ departmentCount: 0, employeeCount: 0, totalShiftsCount: 0, totalOvertimeHours: 0, totalLateEarlyHours: 0, unexcusedAbsenceCount: 0, onTimePunches: 0, totalPunches: 0, onTimeRate: 100, totalSalary: 0, selectedPeriod: '2026-01' }} />);
    expect(html).not.toContain('100.0%');
    expect(html).toContain('—');
  });

  it('does not invent a device for an attendance event', () => {
    const html = renderToStaticMarkup(<DashboardRecentLogsTable logs={[{ attendance_id: '1', employee_id: 'E1', employee_name: 'Test', type: 'CHECK_IN', timestamp: '2026-01-01T01:00:00Z', device_id: null, status: 'VALID', statusInfo: { label: 'OK', style: '' } }]} />);
    expect(html).not.toContain('Gate-01');
    expect(html).toContain('—');
  });
});
