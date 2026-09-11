import { Employee, WorkShift, AttendanceRecord, PayrollRecord, UserSession } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    employee_id: "NV-001",
    full_name: "Nguyễn Văn A",
    department: "Kỹ thuật AI",
    position: "AI Engineer Lead",
    phone: "0987.654.321",
    email: "anv@aiot.corp",
    status: "ACTIVE",
    created_at: "2024-01-15T08:00:00Z",
    updated_at: "2026-09-01T08:00:00Z",
    face_enrolled: true,
    fingerprint_enrolled: true,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42",
    base_salary: 22000000,
  },
  {
    employee_id: "NV-002",
    full_name: "Lê Hoàng Phúc",
    department: "Vận hành & IT",
    position: "DevOps Engineer",
    phone: "0912.888.999",
    email: "staff@company.com",
    status: "ACTIVE",
    created_at: "2024-03-10T08:00:00Z",
    updated_at: "2026-09-02T08:00:00Z",
    face_enrolled: true,
    fingerprint_enrolled: true,
    avatar: "https://lh3.googleusercontent.com/aida/AEtjO1WI3ysdLdr6Ya6JgC-p_9Nrkual12Y1Q6p9q4Ln5kqEpHlD50Rf1fcFfWprqeiBnI7yplufSIPIriJBm7cmqB9foAoNHZen3eTFSXz2qDN7q8YMY4rzBTWQDerqU9fyTBkbyV1XkqNLbr1gaEf5pNt4z-p2XSFW0goQoox1RfdhgeYyFDqdH1XwQLMvES4M7Jxu_utGWnqzMjF1b3SMgovKmeeN--rfL1vVW2BVhMloJ9HYKfXBJ81hcv8",
    base_salary: 19500000,
  },
  {
    employee_id: "NV-003",
    full_name: "Nguyễn Minh Anh",
    department: "Nhân sự & HR",
    position: "HR Operations Manager",
    phone: "0934.567.890",
    email: "manager@company.com",
    status: "ACTIVE",
    created_at: "2023-11-01T08:00:00Z",
    updated_at: "2026-09-01T08:00:00Z",
    face_enrolled: true,
    fingerprint_enrolled: true,
    avatar: "https://lh3.googleusercontent.com/aida/AEtjO1U0gZ8qJdE6oYqQ-R2V5d_h0b4VdCqX1_qZ_6M9=s256",
    base_salary: 26000000,
  },
  {
    employee_id: "NV-004",
    full_name: "Trần Thu Thảo",
    department: "Kỹ thuật AI",
    position: "Computer Vision Researcher",
    phone: "0905.123.456",
    email: "thao.tran@aiot.corp",
    status: "ACTIVE",
    created_at: "2024-05-20T08:00:00Z",
    updated_at: "2026-09-03T08:00:00Z",
    face_enrolled: true,
    fingerprint_enrolled: false,
    avatar: "https://lh3.googleusercontent.com/aida/AEtjO1Xw6tE-Kl6RJ0I4DImDsStSZc3dy2IU_ZbQk7wMhedEX9JhhFr0BZokHPz0wSZrZhqjYywULEMWtq5lPcL84X3aM6fdTnuWFHzAYO3Bq6xU57QOSfoPRD7TkdbT3C60GjGqI1SuN0moP_3u2hSYDZHJ_pViM0_ZPsVZizt9_RU5HK2yV0zXt5eWr5Un4rF1mMKbeZWwUieS7vg9zysgFJYqzQ9echXu2Lpdj6jcibnSkIeyv6bp8_gD3rg",
    base_salary: 21000000,
  },
  {
    employee_id: "NV-005",
    full_name: "Nguyễn Hải Nam",
    department: "Vận hành & IT",
    position: "IoT Hardware Specialist",
    phone: "0977.444.333",
    email: "nam.nguyen@aiot.corp",
    status: "ACTIVE",
    created_at: "2024-06-15T08:00:00Z",
    updated_at: "2026-09-04T08:00:00Z",
    face_enrolled: true,
    fingerprint_enrolled: true,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    base_salary: 18000000,
  },
  {
    employee_id: "NV-006",
    full_name: "Vũ Khánh Linh",
    department: "Kinh doanh & Dự án",
    position: "Solutions Specialist",
    phone: "0944.555.666",
    email: "linh.vu@aiot.corp",
    status: "INACTIVE",
    created_at: "2024-02-01T08:00:00Z",
    updated_at: "2026-08-30T08:00:00Z",
    face_enrolled: false,
    fingerprint_enrolled: true,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    base_salary: 17000000,
  }
];

export const INITIAL_SHIFTS: WorkShift[] = [
  // Nguyễn Văn A (NV-001) - Week 36 / 37
  { shift_id: "S001", employee_id: "NV-001", date: "2026-09-07", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Kỹ thuật AI", note: "Lab 02 Kỹ thuật" },
  { shift_id: "S002", employee_id: "NV-001", date: "2026-09-08", start_time: "08:00", end_time: "19:30", shift_type: "OFFICE_HOURS", department: "Kỹ thuật AI", note: "Ca kỹ thuật + OT 2h" },
  { shift_id: "S003", employee_id: "NV-001", date: "2026-09-09", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Kỹ thuật AI", note: "Lab 02 Kỹ thuật" },
  { shift_id: "S004", employee_id: "NV-001", date: "2026-09-10", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Kỹ thuật AI", note: "Hôm nay - Chuẩn ca" },
  { shift_id: "S005", employee_id: "NV-001", date: "2026-09-11", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Kỹ thuật AI", note: "Sảnh AI Gate A" },
  { shift_id: "S006", employee_id: "NV-001", date: "2026-09-12", start_time: "08:30", end_time: "12:30", shift_type: "MORNING", department: "Kỹ thuật AI", note: "Ca OT Tự chọn (4h)" },
  { shift_id: "S007", employee_id: "NV-001", date: "2026-09-13", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Kỹ thuật AI", note: "Nghỉ tuần" },

  // Lê Hoàng Phúc (NV-002)
  { shift_id: "S008", employee_id: "NV-002", date: "2026-09-07", start_time: "08:30", end_time: "17:30", shift_type: "MORNING", department: "Vận hành & IT" },
  { shift_id: "S009", employee_id: "NV-002", date: "2026-09-08", start_time: "08:30", end_time: "17:30", shift_type: "MORNING", department: "Vận hành & IT" },
  { shift_id: "S010", employee_id: "NV-002", date: "2026-09-09", start_time: "08:30", end_time: "17:30", shift_type: "MORNING", department: "Vận hành & IT" },
  { shift_id: "S011", employee_id: "NV-002", date: "2026-09-10", start_time: "08:30", end_time: "17:30", shift_type: "MORNING", department: "Vận hành & IT" },
  { shift_id: "S012", employee_id: "NV-002", date: "2026-09-11", start_time: "08:30", end_time: "17:30", shift_type: "MORNING", department: "Vận hành & IT" },
  { shift_id: "S013", employee_id: "NV-002", date: "2026-09-12", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Vận hành & IT" },
  { shift_id: "S014", employee_id: "NV-002", date: "2026-09-13", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Vận hành & IT" },

  // Nguyễn Minh Anh (NV-003)
  { shift_id: "S015", employee_id: "NV-003", date: "2026-09-07", start_time: "08:00", end_time: "17:00", shift_type: "OFFICE_HOURS", department: "Nhân sự & HR" },
  { shift_id: "S016", employee_id: "NV-003", date: "2026-09-08", start_time: "08:00", end_time: "17:00", shift_type: "OFFICE_HOURS", department: "Nhân sự & HR" },
  { shift_id: "S017", employee_id: "NV-003", date: "2026-09-09", start_time: "08:00", end_time: "17:00", shift_type: "OFFICE_HOURS", department: "Nhân sự & HR" },
  { shift_id: "S018", employee_id: "NV-003", date: "2026-09-10", start_time: "08:00", end_time: "17:00", shift_type: "OFFICE_HOURS", department: "Nhân sự & HR" },
  { shift_id: "S019", employee_id: "NV-003", date: "2026-09-11", start_time: "08:00", end_time: "17:00", shift_type: "OFFICE_HOURS", department: "Nhân sự & HR" },
  { shift_id: "S020", employee_id: "NV-003", date: "2026-09-12", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Nhân sự & HR" },
  { shift_id: "S021", employee_id: "NV-003", date: "2026-09-13", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Nhân sự & HR" },

  // Trần Thu Thảo (NV-004)
  { shift_id: "S022", employee_id: "NV-004", date: "2026-09-07", start_time: "13:00", end_time: "21:30", shift_type: "AFTERNOON", department: "Kỹ thuật AI" },
  { shift_id: "S023", employee_id: "NV-004", date: "2026-09-08", start_time: "13:00", end_time: "21:30", shift_type: "AFTERNOON", department: "Kỹ thuật AI" },
  { shift_id: "S024", employee_id: "NV-004", date: "2026-09-09", start_time: "13:00", end_time: "21:30", shift_type: "AFTERNOON", department: "Kỹ thuật AI" },
  { shift_id: "S025", employee_id: "NV-004", date: "2026-09-10", start_time: "13:00", end_time: "21:30", shift_type: "AFTERNOON", department: "Kỹ thuật AI" },
  { shift_id: "S026", employee_id: "NV-004", date: "2026-09-11", start_time: "13:00", end_time: "21:30", shift_type: "AFTERNOON", department: "Kỹ thuật AI" },
  { shift_id: "S027", employee_id: "NV-004", date: "2026-09-12", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Kỹ thuật AI" },
  { shift_id: "S028", employee_id: "NV-004", date: "2026-09-13", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Kỹ thuật AI" },

  // Nguyễn Hải Nam (NV-005)
  { shift_id: "S029", employee_id: "NV-005", date: "2026-09-07", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Vận hành & IT" },
  { shift_id: "S030", employee_id: "NV-005", date: "2026-09-08", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Vận hành & IT" },
  { shift_id: "S031", employee_id: "NV-005", date: "2026-09-09", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Vận hành & IT" },
  { shift_id: "S032", employee_id: "NV-005", date: "2026-09-10", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Vận hành & IT" },
  { shift_id: "S033", employee_id: "NV-005", date: "2026-09-11", start_time: "08:00", end_time: "17:30", shift_type: "OFFICE_HOURS", department: "Vận hành & IT" },
  { shift_id: "S034", employee_id: "NV-005", date: "2026-09-12", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Vận hành & IT" },
  { shift_id: "S035", employee_id: "NV-005", date: "2026-09-13", start_time: "00:00", end_time: "00:00", shift_type: "OFF", department: "Vận hành & IT" },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  // Today's Check-ins (2026-09-10)
  {
    attendance_id: "ATT-101",
    employee_id: "NV-001",
    type: "CHECK_IN",
    timestamp: "2026-09-10T08:02:14Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.998,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-102",
    employee_id: "NV-002",
    type: "CHECK_IN",
    timestamp: "2026-09-10T08:26:05Z",
    method: "FACE",
    device_id: "CAM-04",
    verification_score: 0.994,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-103",
    employee_id: "NV-003",
    type: "CHECK_IN",
    timestamp: "2026-09-10T07:55:40Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.999,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-104",
    employee_id: "NV-005",
    type: "CHECK_IN",
    timestamp: "2026-09-10T08:35:10Z",
    method: "FINGERPRINT",
    device_id: "FP-Gate-02",
    verification_score: 0.985,
    status: "LATE"
  },

  // Past days in week for NV-001
  {
    attendance_id: "ATT-091",
    employee_id: "NV-001",
    type: "CHECK_IN",
    timestamp: "2026-09-09T08:01:20Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.997,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-092",
    employee_id: "NV-001",
    type: "CHECK_OUT",
    timestamp: "2026-09-09T17:32:00Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.995,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-081",
    employee_id: "NV-001",
    type: "CHECK_IN",
    timestamp: "2026-09-08T08:00:10Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.998,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-082",
    employee_id: "NV-001",
    type: "CHECK_OUT",
    timestamp: "2026-09-08T19:30:15Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.996,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-071",
    employee_id: "NV-001",
    type: "CHECK_IN",
    timestamp: "2026-09-07T08:04:00Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.992,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-072",
    employee_id: "NV-001",
    type: "CHECK_OUT",
    timestamp: "2026-09-07T17:35:00Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.998,
    status: "ON_TIME"
  },

  // Past records for other employees
  {
    attendance_id: "ATT-093",
    employee_id: "NV-002",
    type: "CHECK_IN",
    timestamp: "2026-09-09T08:28:00Z",
    method: "FACE",
    device_id: "FaceCam-02",
    verification_score: 0.992,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-094",
    employee_id: "NV-002",
    type: "CHECK_OUT",
    timestamp: "2026-09-09T17:31:00Z",
    method: "FACE",
    device_id: "FaceCam-02",
    verification_score: 0.991,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-095",
    employee_id: "NV-003",
    type: "CHECK_IN",
    timestamp: "2026-09-09T08:00:00Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.999,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-096",
    employee_id: "NV-004",
    type: "CHECK_IN",
    timestamp: "2026-09-09T13:02:10Z",
    method: "FACE",
    device_id: "FaceCam-01",
    verification_score: 0.994,
    status: "ON_TIME"
  },
  {
    attendance_id: "ATT-097",
    employee_id: "NV-005",
    type: "CHECK_IN",
    timestamp: "2026-09-09T08:15:00Z",
    method: "FINGERPRINT",
    device_id: "FP-Gate-02",
    verification_score: 0.980,
    status: "LATE"
  },
  {
    attendance_id: "ATT-098",
    employee_id: "NV-006",
    type: "CHECK_IN",
    timestamp: "2026-08-25T08:30:00Z",
    method: "MANUAL",
    device_id: "Kiosk-Gate-01",
    verification_score: 0.850,
    status: "ON_TIME"
  }
];

export const INITIAL_PAYROLL: PayrollRecord[] = [
  // Period 2026-08 (Pending finalize / testing)
  {
    payroll_id: "PR-202608-001",
    employee_id: "NV-001",
    period: "2026-08",
    base_salary: 22000000,
    allowance: 2500000,
    deduction: 1050000,
    total_paid: 23450000,
    working_days: 22,
    working_hours: 176,
    late_count: 0,
    status: "PENDING"
  },
  {
    payroll_id: "PR-202608-002",
    employee_id: "NV-002",
    period: "2026-08",
    base_salary: 19500000,
    allowance: 1800000,
    deduction: 950000,
    total_paid: 20350000,
    working_days: 22,
    working_hours: 176,
    late_count: 1,
    status: "PENDING"
  },
  {
    payroll_id: "PR-202608-003",
    employee_id: "NV-003",
    period: "2026-08",
    base_salary: 26000000,
    allowance: 3200000,
    deduction: 1300000,
    total_paid: 27900000,
    working_days: 22,
    working_hours: 176,
    late_count: 0,
    status: "PENDING"
  },
  {
    payroll_id: "PR-202608-004",
    employee_id: "NV-004",
    period: "2026-08",
    base_salary: 21000000,
    allowance: 2000000,
    deduction: 1000000,
    total_paid: 22000000,
    working_days: 21,
    working_hours: 168,
    late_count: 0,
    status: "PENDING"
  },
  {
    payroll_id: "PR-202608-005",
    employee_id: "NV-005",
    period: "2026-08",
    base_salary: 18000000,
    allowance: 1500000,
    deduction: 1200000,
    total_paid: 18300000,
    working_days: 20,
    working_hours: 160,
    late_count: 3,
    status: "PENDING"
  },

  // Period 2026-07 (FINALIZED / Locked)
  {
    payroll_id: "PR-202607-001",
    employee_id: "NV-001",
    period: "2026-07",
    base_salary: 22000000,
    allowance: 2200000,
    deduction: 1050000,
    total_paid: 23150000,
    working_days: 23,
    working_hours: 184,
    late_count: 0,
    status: "FINALIZED"
  },
  {
    payroll_id: "PR-202607-002",
    employee_id: "NV-002",
    period: "2026-07",
    base_salary: 19500000,
    allowance: 1800000,
    deduction: 950000,
    total_paid: 20350000,
    working_days: 23,
    working_hours: 184,
    late_count: 0,
    status: "FINALIZED"
  },
  {
    payroll_id: "PR-202607-003",
    employee_id: "NV-003",
    period: "2026-07",
    base_salary: 26000000,
    allowance: 3200000,
    deduction: 1300000,
    total_paid: 27900000,
    working_days: 23,
    working_hours: 184,
    late_count: 0,
    status: "FINALIZED"
  }
];

export const DEMO_USERS: Record<string, UserSession> = {
  manager: {
    employee_id: "NV-003",
    full_name: "Nguyễn Minh Anh",
    email: "manager@company.com",
    role: "manager",
    position: "HR Operations Manager",
    department: "Nhân sự & HR",
    avatar: "https://lh3.googleusercontent.com/aida/AEtjO1U0gZ8qJdE6oYqQ-R2V5d_h0b4VdCqX1_qZ_6M9=s256",
  },
  staff: {
    employee_id: "NV-001",
    full_name: "Nguyễn Văn A",
    email: "staff@company.com",
    role: "staff",
    position: "AI Engineer Lead",
    department: "Kỹ thuật AI",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42",
  }
};
