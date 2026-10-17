import { Router } from 'express';
import { authRouter } from './modules/auth/index.js';
import { employeeRouter, departmentRouter, positionRouter } from './modules/employees/index.js';
import { attendanceRouter } from './modules/attendance/index.js';
import { biometricRouter } from './modules/biometrics/index.js';
import { deviceRouter } from './modules/devices/index.js';
import { payrollRouter } from './modules/payroll/index.js';
import { shiftRouter } from './modules/shifts/index.js';
import { auditRouter } from './modules/audit-logs/index.js';

export const apiRouter = Router();

// Modular Feature-based API Routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/positions', positionRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/biometrics', biometricRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/payroll', payrollRouter);
apiRouter.use('/shifts', shiftRouter);
apiRouter.use('/audit-logs', auditRouter);
