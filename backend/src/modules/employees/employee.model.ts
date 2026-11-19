import { prisma } from '../../config/database.js'
import { faceEnrollmentSummarySelect } from './employee.integration-port.js'

export const employeeModel = prisma.employee

// Include đúng theo Prisma schema:
// - department (relation qua departmentId)
// - employee_shifts (relation nhiều-nhiều với work_shifts)
// - face_embeddings (biometric data read projection owned by biometrics)
// KHÔNG có: shift, biometricData (tên này không tồn tại trong schema)
export const employeeInclude = {
  department: true,
  position: true,
  users: {
    select: {
      id: true,
      username: true,
      role_id: true,
      is_active: true,
      roles: {
        select: {
          id: true,
          role_name: true,
        },
      },
    },
  },
  employee_shifts: {
    include: { work_shifts: true },
    orderBy: { work_date: 'desc' as const },
    take: 1,
  },
  get face_embeddings() {
    return faceEnrollmentSummarySelect()
  },
} as const
