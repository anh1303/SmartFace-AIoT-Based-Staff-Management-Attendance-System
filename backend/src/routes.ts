import { Router } from 'express';
import { authRouter } from './modules/auth/auth.controller.js';
import { employeeRouter } from './modules/employees/employee.controller.js';
import { departmentRouter } from './modules/employees/department.controller.js';
import { attendanceRouter } from './modules/attendance/attendance.controller.js';
import { biometricRouter } from './modules/biometrics/biometric.controller.js';
import { deviceRouter } from './modules/devices/device.controller.js';
import { payrollRouter } from './modules/payroll/payroll.controller.js';
import { shiftRouter } from './modules/shifts/shift.controller.js';
import { auditRouter } from './modules/audit-logs/audit.controller.js';

export const apiRouter = Router();

// Modular API Routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/positions', departmentRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/biometrics', biometricRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/payroll', payrollRouter);
apiRouter.use('/shifts', shiftRouter);
apiRouter.use('/audit-logs', auditRouter);
