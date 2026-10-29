export type PayrollStatus = 'PENDING' | 'CONFIRMED' | 'FINALIZED' | 'PAID';
export type RateKind = 'FIXED_PER_HOUR' | 'HOURLY_MULTIPLIER';

export interface PayrollBreakdown {
  base_salary: number;
  overtime_pay: number;
  late_early_deduction: number;
  absence_deduction: number;
  allowance: number;
  net_salary: number;
}

export interface BonusPenaltyPolicy {
  id?: number;
  overtime_rate: number;
  overtime_rate_kind: RateKind;
  late_early_penalty: number;
  late_early_penalty_kind: RateKind;
  absence_penalty_rate?: number;
  description?: string;
}

export interface PayrollRecord {
  id?: string;
  payroll_id: string;
  employee_id: string;
  employee_name?: string;
  department?: string;
  period: string;          // "2026-08"
  payroll_period?: string;
  hourly_rate: number;
  total_working_hours?: number;
  working_hours?: number;
  total_overtime: number;
  total_late_early: number;
  total_absence_penalty?: number;
  allowance: number;
  net_salary: number;
  status: PayrollStatus;
  reason?: string;
  overtime_rate?: number | null;
  overtime_rate_kind?: RateKind | null;
  late_penalty_rate?: number | null;
  late_penalty_rate_kind?: RateKind | null;
  late_early_penalty?: number | null;
  breakdown?: PayrollBreakdown | null;
  needs_recalculation?: boolean;
  requires_reconciliation?: boolean;
  updated_at?: string;
  calculation_details?: unknown;
}
