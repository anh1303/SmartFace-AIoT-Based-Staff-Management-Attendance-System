export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const EMPLOYEE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TERMINATED: 'TERMINATED',
} as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS]

export const ATTENDANCE_TYPE = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
} as const

export type AttendanceType = (typeof ATTENDANCE_TYPE)[keyof typeof ATTENDANCE_TYPE]

export const ATTENDANCE_METHOD = {
  FACE: 'FACE',
  FINGERPRINT: 'FINGERPRINT',
  MANUAL: 'MANUAL',
  CARD: 'CARD',
} as const

export type AttendanceMethod = (typeof ATTENDANCE_METHOD)[keyof typeof ATTENDANCE_METHOD]

export const ATTENDANCE_LOG_STATUS = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  FLAGGED: 'FLAGGED',
} as const

export type AttendanceLogStatus = (typeof ATTENDANCE_LOG_STATUS)[keyof typeof ATTENDANCE_LOG_STATUS]

export const ATTENDANCE_PUNCTUALITY = {
  ON_TIME: 'ON_TIME',
  LATE: 'LATE',
  EARLY_LEAVE: 'EARLY_LEAVE',
} as const

export type AttendancePunctuality = (typeof ATTENDANCE_PUNCTUALITY)[keyof typeof ATTENDANCE_PUNCTUALITY]

export const DAILY_ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EARLY_LEAVE: 'EARLY_LEAVE',
  ON_LEAVE: 'ON_LEAVE',
} as const

export type DailyAttendanceStatus = (typeof DAILY_ATTENDANCE_STATUS)[keyof typeof DAILY_ATTENDANCE_STATUS]

export const DEVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
} as const

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS]

export const PAYROLL_STATUS = {
  PENDING: 'PENDING',
  FINALIZED: 'FINALIZED',
  CONFIRMED: 'CONFIRMED',
  PAID: 'PAID',
} as const

export type PayrollStatus = (typeof PAYROLL_STATUS)[keyof typeof PAYROLL_STATUS]

export const SHIFT_TYPE = {
  OFFICE_HOURS: 'OFFICE_HOURS',
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  NIGHT: 'NIGHT',
  OVERTIME: 'OVERTIME',
} as const

export type ShiftType = (typeof SHIFT_TYPE)[keyof typeof SHIFT_TYPE]

export const BIOMETRIC_DEFAULTS = {
  MODEL_VERSION: 'arcface_v1',
  SAMPLE_TAG: 'FRONTAL',
} as const
