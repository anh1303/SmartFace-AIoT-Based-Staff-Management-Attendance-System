export type Role = 'manager' | 'staff';

export interface Employee {
  employee_id: string;      // "NV001"
  full_name: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
  face_enrolled: boolean;
  fingerprint_enrolled: boolean;
  avatar?: string;
  base_salary?: number;
}

export interface WorkShift {
  shift_id: string;
  employee_id: string;
  date: string;           // "2026-09-08"
  start_time: string;      // "08:00"
  end_time: string;        // "17:30"
  shift_type: "MORNING" | "AFTERNOON" | "OFFICE_HOURS" | "OFF";
  department: string;
  note?: string;
}

export interface AttendanceRecord {
  attendance_id: string;
  employee_id: string;
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: string;       // ISO datetime
  method: "FACE" | "FINGERPRINT" | "MANUAL";
  device_id: string;
  verification_score: number; // 0-1
  status: "ON_TIME" | "LATE" | "EARLY_LEAVE" | "ABSENT";
}

export interface PayrollRecord {
  payroll_id: string;
  employee_id: string;
  period: string;          // "2026-08"
  base_salary: number;
  allowance: number;
  deduction: number;
  total_paid: number;
  working_days: number;
  working_hours: number;
  late_count: number;
  status: "PENDING" | "FINALIZED";
}

export interface UserSession {
  employee_id: string;
  full_name: string;
  email: string;
  role: Role;
  position: string;
  department: string;
  avatar: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
