export interface BonusPenaltyPolicy {
  id?: number;
  overtime_rate: number;
  late_early_penalty: number;
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
  allowance: number;
  net_salary: number;
  status: 'PENDING' | 'FINALIZED';
}
