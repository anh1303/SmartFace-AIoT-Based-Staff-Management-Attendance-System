export type ShiftType = 'MORNING' | 'AFTERNOON' | 'OFFICE_HOURS' | 'OFF';

export interface WorkShift {
  shift_id: string;
  employee_id: string;
  date: string;           // "2026-09-08"
  work_day?: string;      // "Thứ Hai", "Thứ Ba", ...
  start_time: string;      // "08:00"
  end_time: string;        // "17:30"
  shift_type: ShiftType;
  department: string;
  note?: string;
}
