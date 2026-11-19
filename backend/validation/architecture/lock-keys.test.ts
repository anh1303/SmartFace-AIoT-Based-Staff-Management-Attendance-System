import { describe, expect, it } from 'vitest';
import { employeeLockKey, payrollPeriodLockKey } from '../../src/common/lock-keys.js';

describe('PostgreSQL advisory lock key rolling-deployment compatibility', () => {
  it('generates the exact byte-for-byte lock key strings used prior to Phase 2', () => {
    expect(employeeLockKey('emp-123')).toBe('employee:emp-123');
    expect(employeeLockKey('00000000-0000-0000-0000-000000000001')).toBe(
      'employee:00000000-0000-0000-0000-000000000001',
    );
    expect(payrollPeriodLockKey('2026-10')).toBe('payroll:2026-10');
    expect(payrollPeriodLockKey('2026-11')).toBe('payroll:2026-11');
  });
});
