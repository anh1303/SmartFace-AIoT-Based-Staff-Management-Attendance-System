import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BulkShiftModal } from './BulkShiftModal';

vi.mock('../../../components/common/Modal', () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const props = {
  isOpen: true, onClose: vi.fn(), weekNumber: 1, startLabel: '', endLabel: '', employees: [],
  departments: ['IT', 'Sales'], managerDepartment: 'IT', bulkTarget: 'ALL', setBulkTarget: vi.fn(),
  bulkDepartment: '', setBulkDepartment: vi.fn(), bulkShiftType: 'OFFICE_HOURS' as const,
  setBulkShiftType: vi.fn(), bulkStartTime: '08:00', setBulkStartTime: vi.fn(), bulkEndTime: '17:00',
  setBulkEndTime: vi.fn(), bulkDays: [], setBulkDays: vi.fn(), bulkNote: '', setBulkNote: vi.fn(), onSubmit: vi.fn(),
};

describe('bulk department selection', () => {
  it('disables other departments for a manager', () => {
    const html = renderToStaticMarkup(<BulkShiftModal {...props} />);
    expect(html).toMatch(/<button[^>]*title="Sales"[^>]* disabled=""/);
    expect(html).not.toMatch(/<button[^>]*title="IT"[^>]* disabled=""/);
  });

  it('allows all departments for an administrator', () => {
    const html = renderToStaticMarkup(<BulkShiftModal {...props} managerDepartment={undefined} />);
    expect(html).not.toMatch(/<button[^>]*title="Sales"[^>]* disabled=""/);
  });

  it('disables departments when the manager has no department', () => {
    const html = renderToStaticMarkup(<BulkShiftModal {...props} managerDepartment={null} />);
    expect(html).toMatch(/<button[^>]*title="IT"[^>]* disabled=""/);
  });
});
