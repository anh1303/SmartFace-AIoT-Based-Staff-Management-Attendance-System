import { Router } from 'express';
import { operationRouter } from './modules/operations/operation.routes.js';
import { authRouter } from './modules/auth/index.js';
import { employeeRouter, departmentRouter, positionRouter } from './modules/employees/index.js';
import { attendanceRouter, notificationRouter } from './modules/attendance/index.js';
import { biometricRouter, fingerprintDeviceRouter } from './modules/biometrics/index.js';
import { deviceRouter } from './modules/devices/index.js';
import { payrollRouter } from './modules/payroll/index.js';
import { shiftRouter } from './modules/shifts/index.js';
import { auditRouter } from './modules/audit-logs/index.js';
import { reportsRouter } from './modules/reports/index.js';
import { dashboardRouter } from './modules/dashboard/index.js';

export const apiRouter = Router();
apiRouter.use('/operations', operationRouter);

// Modular Feature-based API Routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/positions', positionRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/biometrics', biometricRouter);
apiRouter.use('/devices/:id/fingerprint', fingerprintDeviceRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/payroll', payrollRouter);
apiRouter.use('/shifts', shiftRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/dashboard', dashboardRouter);


