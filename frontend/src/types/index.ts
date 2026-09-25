export type Role = 'manager' | 'employee';

export interface Employee {
  id?: string;
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
  hourly_rate?: number;
}

export interface WorkShift {
  shift_id: string;
  employee_id: string;
  date: string;           // "2026-09-08"
  work_day?: string;      // "Thứ Hai", "Thứ Ba", ...
  start_time: string;      // "08:00"
  end_time: string;        // "17:30"
  shift_type: "MORNING" | "AFTERNOON" | "OFFICE_HOURS" | "OFF";
  department: string;
  note?: string;
}

export interface AttendanceRecord {
  id?: string;
  attendance_id: string;
  employee_id: string;
  type: "CHECK_IN" | "CHECK_OUT" | "TAN_CA";
  timestamp: string;       // ISO datetime
  method: "FACE" | "FINGERPRINT" | "MANUAL" | "CARD";
  device_id: string;
  verification_score: number; // 0-1
  status: "VALID" | "INVALID" | "FLAGGED";
  punctuality?: "ON_TIME" | "LATE" | "EARLY_LEAVE";
  raw_status?: string;
}

export interface DailyAttendanceSummary {
  id?: string;
  employee_id: string;
  work_date: string;
  shift_id?: number;
  first_check_in?: string | null;
  last_check_out?: string | null;
  total_working_hours?: number;
  late_early: number;   // Số giờ đi trễ / về sớm (đơn vị: giờ, làm tròn nấc 0.5h)
  overtime: number;     // Số giờ tăng ca (đơn vị: giờ, làm tròn nấc 0.5h)
  attendance_status: string;
  updated_at?: string;
}

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
  status: "PENDING" | "FINALIZED";
}

export interface UserSession {
  employee_id: string;
  full_name: string;
  email: string;
  role: Role;
  role_name?: string;
  is_manager?: boolean;
  position: string;
  department: string;
  avatar: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}