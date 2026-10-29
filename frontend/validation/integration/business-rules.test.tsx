// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../src/features/schedules/components/ShiftTemplates', () => ({ ShiftTemplatePicker: () => null, templateAssignment: vi.fn() }));
import { ShiftEditModal } from '../../src/features/schedules/components/ShiftEditModal';
import { BulkShiftModal } from '../../src/features/schedules/components/BulkShiftModal';
vi.mock('../../src/api/payrollApi', () => ({ previewEarlySettlementApi: vi.fn() }));
import { previewEarlySettlementApi } from '../../src/api/payrollApi';
import { EarlySettlementModal } from '../../src/features/payrolls/components/EarlySettlementModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it('lets managers save an overnight individual shift and explains its end day', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<ShiftEditModal editingShift={{ employeeId: 'NV01', employeeName: 'Test', date: '2026-10-31', dayLabel: '31/10', shift: undefined }} onClose={() => {}} shiftType="OTHER" setShiftType={() => {}} startTime="22:00" setStartTime={() => {}} endTime="06:00" setEndTime={() => {}} note="" setNote={() => {}} onSubmit={() => {}} />));
    expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.textContent).toContain('ngày hôm sau');
    expect(document.body.textContent).toContain('8 giờ');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('lets managers assign overnight shifts in bulk', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const noop = () => {};
  try {
    await act(async () => root.render(<BulkShiftModal isOpen onClose={noop} weekNumber={44} startLabel="26/10" endLabel="01/11" employees={[]} bulkTarget="ALL" setBulkTarget={noop} bulkDepartment="" setBulkDepartment={noop} bulkShiftType="OTHER" setBulkShiftType={noop} bulkStartTime="22:00" setBulkStartTime={noop} bulkEndTime="06:00" setBulkEndTime={noop} bulkDays={[1]} setBulkDays={noop} bulkNote="" setBulkNote={noop} onSubmit={noop} />));
    expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.textContent).toContain('ngày hôm sau');
    expect(document.body.textContent).toContain('8 giờ');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('requires a preview and blocks settlement when later work exists', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'));
  vi.mocked(previewEarlySettlementApi).mockResolvedValue({ blocked: true, conflict_dates: ['2026-10-30'], worked_hours_after_cutoff: 8, approved_adjustments_after_cutoff: 0, shift_dates_after_cutoff: ['2026-10-30'], adjustments_to_remove: [] });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const confirm = vi.fn();
  try {
    await act(async () => root.render(<EarlySettlementModal isOpen onClose={() => {}} selectedPeriod="2026-10" record={{ payroll_id: 'p1', employee_id: 'NV01' } as any} employeeName="Test" onConfirm={confirm} />));
    expect(document.body.textContent).toContain('Xem trước quyết toán');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(document.body.textContent).toContain('2026-10-30');
    expect(document.body.textContent).toContain('Chưa thể quyết toán');
    expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('submits settlement only after the user has seen an allowed preview and confirms again', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00+07:00'));
  vi.mocked(previewEarlySettlementApi).mockResolvedValue({ blocked: false, conflict_dates: [], worked_hours_after_cutoff: 0, approved_adjustments_after_cutoff: 0, shift_dates_after_cutoff: ['2026-10-30'], adjustments_to_remove: [] });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); const confirm = vi.fn(async () => {});
  try {
    await act(async () => root.render(<EarlySettlementModal isOpen onClose={() => {}} selectedPeriod="2026-10" record={{ payroll_id: 'p1', employee_id: 'NV01' } as any} employeeName="Test" onConfirm={confirm} />));
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(document.body.textContent).toContain('2026-10-30');
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(confirm).toHaveBeenCalledExactlyOnceWith('2026-10-29', 'Nhân viên nghỉ việc / chấm dứt hợp đồng lao động');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
