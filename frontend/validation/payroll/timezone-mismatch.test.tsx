// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollFinalizeModal } from '../../src/features/payrolls/components/PayrollActionModals';
import { EarlySettlementModal } from '../../src/features/payrolls/components/EarlySettlementModal';
import type { PayrollRecord } from '../../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Frontend UI Timezone Mismatch (Scenario 5)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.useRealTimers();
  });

  it('enables finalization for 2026-10 when Vietnam is 01:30 on 2026-11-01 (even if UTC is still 2026-10-31)', async () => {
    // 01:30 AM on Nov 1, 2026 in Vietnam (+07:00) is 18:30 PM on Oct 31, 2026 in UTC
    const vnTimeAfterMonthEnd = new Date('2026-11-01T01:30:00+07:00');
    vi.setSystemTime(vnTimeAfterMonthEnd);

    await act(async () => {
      root.render(
        <PayrollFinalizeModal
          isOpen={true}
          onClose={() => {}}
          selectedPeriod="2026-10"
          totalExpense={50000000}
          employeeCount={10}
          onConfirm={() => {}}
        />
      );
    });

    const bodyHtml = document.body.innerHTML;
    // The modal should recognize that October 2026 has ended in VN time
    expect(bodyHtml).not.toContain('Kỳ lương chưa kết thúc');
    expect(bodyHtml).toContain('Lưu ý bảo mật');
    // Button must be enabled
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const finalizeBtn = buttons.find((b) => b.textContent?.includes('Đồng ý chốt bảng lương'));
    expect(finalizeBtn).toBeDefined();
    expect(finalizeBtn?.hasAttribute('disabled')).toBe(false);
  });

  it('disables finalization for current month 2026-11 when Vietnam is 01:30 on 2026-11-01', async () => {
    const vnTimeStartOfMonth = new Date('2026-11-01T01:30:00+07:00');
    vi.setSystemTime(vnTimeStartOfMonth);

    await act(async () => {
      root.render(
        <PayrollFinalizeModal
          isOpen={true}
          onClose={() => {}}
          selectedPeriod="2026-11"
          totalExpense={50000000}
          employeeCount={10}
          onConfirm={() => {}}
        />
      );
    });

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Kỳ lương chưa kết thúc');
    const finalizeBtn = document.body.querySelector('button[disabled]');
    expect(finalizeBtn?.textContent).toContain('Đồng ý chốt bảng lương');
  });

  it('correctly sets default cutoffDate and validation to VN date (2026-10-15) even when UTC is still 2026-10-14', async () => {
    // 01:30 AM on Oct 15, 2026 in Vietnam is 18:30 PM on Oct 14 in UTC
    const vnTimeMidnight = new Date('2026-10-15T01:30:00+07:00');
    vi.setSystemTime(vnTimeMidnight);

    const mockRecord = {
      payroll_id: 'p-01',
      employee_id: 'NV01',
      period: '2026-10',
      total_working_hours: 8,
      net_salary: 2000000,
      status: 'PENDING',
    } as unknown as PayrollRecord;

    await act(async () => {
      root.render(
        <EarlySettlementModal
          isOpen={true}
          onClose={() => {}}
          selectedPeriod="2026-10"
          record={mockRecord}
          employeeName="Nguyễn Văn A"
          onConfirm={async () => {}}
        />
      );
    });

    const input = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // Default cutoff date in input value should be 2026-10-15 (Vietnam date), not 2026-10-14 (UTC)
    expect(input.value).toBe('2026-10-15');
    expect(input.getAttribute('max')).toBe('2026-10-15');
  });
});
