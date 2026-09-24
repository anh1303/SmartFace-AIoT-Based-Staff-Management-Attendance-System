import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { successResponse } from './common/response.js'
import { authRouter } from './modules/auth/auth.controller.js'
import { employeeRouter } from './modules/employees/employee.controller.js'
import { attendanceRouter } from './modules/attendance/attendance.controller.js'
import { biometricRouter } from './modules/biometrics/biometric.controller.js'
import { deviceRouter } from './modules/devices/device.controller.js'
import { payrollRouter } from './modules/payroll/payroll.controller.js'
import { shiftRouter } from './modules/shifts/shift.controller.js'
import { auditRouter } from './modules/audit-logs/audit.controller.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()) }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Health check
app.get('/health', (_req, res) => successResponse(res, { status: 'ok' }))

// API Routes
app.use('/api/auth', authRouter)
app.use('/api/employees', employeeRouter)
app.use('/api/attendance', attendanceRouter)
app.use('/api/biometrics', biometricRouter)
app.use('/api/devices', deviceRouter)
app.use('/api/payroll', payrollRouter)
app.use('/api/shifts', shiftRouter)
app.use('/api/audit-logs', auditRouter)

app.use(notFound)
app.use(errorHandler)