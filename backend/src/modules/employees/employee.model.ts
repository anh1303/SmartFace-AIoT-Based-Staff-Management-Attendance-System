import { prisma } from '../../config/database.js'
import { UUID_REGEX } from '../../common/utils.js'
import { faceEnrollmentSummarySelect } from './employee.integration-port.js'

export const employeeModel = prisma.employee

/**
 * Builds a Prisma `where` clause for the `Employee` model:
 * If the input is a UUID, filters by `{ id }`. Otherwise, filters by `{ employee_code }`.
 */
export function buildIdOrCodeWhere(idOrCode: string): { id: string } | { employee_code: string } {
  if (UUID_REGEX.test(idOrCode)) {
    return { id: idOrCode }
  }
  return { employee_code: idOrCode }
}

// Include đúng theo Prisma schema:
// - department (relation qua departmentId)
// - employee_shifts (relation nhiều-nhiều với work_shifts)
// - face_embeddings (biometric data read projection owned by biometrics)
// KHÔNG có: shift, biometricData (tên này không tồn tại trong schema)
export const employeeListInclude = {
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
  get face_embeddings() {
    return faceEnrollmentSummarySelect()
  },
} as const

export const employeeInclude = {
  ...employeeListInclude,
  employee_shifts: {
    include: { work_shifts: true },
    orderBy: { work_date: 'desc' as const },
    take: 1,
  },
} as const
