export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT' | 'TAN_CA';
export type AttendanceMethod = 'FACE' | 'FINGERPRINT' | 'MANUAL' | 'CARD';
export type AttendanceStatus = 'VALID' | 'INVALID' | 'FLAGGED';
export type AttendancePunctuality = 'ON_TIME' | 'LATE' | 'EARLY_LEAVE';

export interface AttendanceRecord {
  id?: string;
  attendance_id: string;
  employee_id: string;
  type: AttendanceType;
  timestamp: string;       // ISO datetime
  method: AttendanceMethod;
  device_id: string;
  verification_score: number; // 0-1
  status: AttendanceStatus;
  punctuality?: AttendancePunctuality;
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
