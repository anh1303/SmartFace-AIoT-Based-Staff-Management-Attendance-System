import * as attendance from './modules/attendance/public.js';
import { configureShiftAttendance } from './modules/shifts/shift.attendance-port.js';
import { configureEmployeeIntegration } from './modules/employees/employee.integration-port.js';
import * as auth from './modules/auth/public.js';
import * as biometrics from './modules/biometrics/public.js';
import * as shifts from './modules/shifts/public.js';
import * as payroll from './modules/payroll/public.js';
import { configureAuthBiometrics } from './modules/auth/auth.biometrics-port.js';
import { configureAttendancePayroll } from './modules/attendance/attendance.payroll-port.js';

configureShiftAttendance(attendance);
configureAuthBiometrics(biometrics);
configureAttendancePayroll(payroll);
configureEmployeeIntegration({
  get findAuthUserByUsername() { return auth.findAuthUserByUsername },
  get createAuthUser() { return auth.createAuthUser },
  get updateAuthUser() { return auth.updateAuthUser },
  get getDefaultRole() { return auth.getDefaultRole },
  get deleteAuthUser() { return auth.deleteAuthUser },
  get deleteBiometricsForEmployee() { return biometrics.deleteBiometricsForEmployee },
  get deleteShiftsForEmployee() { return shifts.deleteShiftsForEmployee },
  get hasAttendanceActivity() { return attendance.hasAttendanceActivity },
  get hasPayrollActivity() { return payroll.hasPayrollActivity },
});
