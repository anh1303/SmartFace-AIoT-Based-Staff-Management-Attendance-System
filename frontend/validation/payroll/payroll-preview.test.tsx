// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PayrollItemEditModal } from '../../src/features/payrolls/components/PayrollItemEditModal';

const preview = vi.hoisted(() => vi.fn());
vi.mock('../../src/features/payrolls/api/payrollApi', () => ({ previewPayrollItemApi: preview }));

it('shows only the latest server preview when responses arrive out of order', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  const pending: Array<(value: unknown) => void> = [];
  preview.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const record = { payroll_id: '1', employee_id: 'NV01', period: '2026-10', hourly_rate: 100, allowance: 10, net_salary: 100, status: 'PENDING' as const, updated_at: '2026-10-29T00:00:00.000Z' };
  const render = (allowance: number) => root.render(<PayrollItemEditModal editingItem={{ record, allowance, reason: 'test' }} onClose={() => {}} onChangeEditingItem={() => {}} onConfirmSave={() => {}} otRate={0} lateRate={0} selectedPeriod="2026-10" absenceLabel="—" />);
  try {
    await act(async () => { render(10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { render(20); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { pending[1]({ net_salary: 200, updated_at: record.updated_at }); });
    await act(async () => { pending[0]({ net_salary: 100, updated_at: record.updated_at }); });
    const result = [...document.querySelectorAll('input')].find(input => input.value.includes('200'));
    expect(result).toBeTruthy();
  } finally { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); preview.mockReset(); }
});

it('shows server conflicts instead of fabricating a preview', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  preview.mockRejectedValueOnce(new Error('Phiếu lương vừa thay đổi; tải lại trước khi sửa'));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const record = { payroll_id: '1', employee_id: 'NV01', period: '2026-10', hourly_rate: 100, allowance: 10, net_salary: 100, status: 'PENDING' as const, updated_at: '2026-10-29T00:00:00.000Z' };
  try {
    await act(async () => root.render(<PayrollItemEditModal editingItem={{ record, allowance: 10, reason: 'test' }} onClose={() => {}} onChangeEditingItem={() => {}} onConfirmSave={() => {}} otRate={0} lateRate={0} selectedPeriod="2026-10" absenceLabel="—" />));
    expect([...document.querySelectorAll('input')].some(input => input.value === 'Đang tính…')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect([...document.querySelectorAll('input')].some(input => input.value.includes('tải lại trước khi sửa'))).toBe(true);
  } finally { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); preview.mockReset(); }
});
