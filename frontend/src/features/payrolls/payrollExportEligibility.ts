import type { PayrollRecord } from '../../types';

export function canExportPayroll(records: PayrollRecord[]): boolean {
  const regular = records.filter(record => {
    const details = record.calculation_details as { early_settlement?: { is_early_settlement?: boolean } } | null | undefined;
    return !details?.early_settlement?.is_early_settlement;
  });
  return regular.length > 0 && records.every(record => ['FINALIZED', 'CONFIRMED', 'PAID'].includes(record.status));
}
