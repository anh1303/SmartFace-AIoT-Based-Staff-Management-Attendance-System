import { prisma } from '../../config/database.js'

export const employeeModel = prisma.employee

// Include đúng theo Prisma schema:
// - department (relation qua departmentId)
// - employee_shifts (relation nhiều-nhiều với work_shifts)
// - face_embeddings (biometric data)
// KHÔNG có: shift, biometricData (tên này không tồn tại trong schema)
export const employeeInclude = {
  department: true,
  employee_shifts: {
    include: { work_shifts: true },
    orderBy: { work_date: 'desc' as const },
    take: 1,
  },
  face_embeddings: {
    where: { is_active: true },
    select: { id: true, model_version: true, sample_tag: true, quality_score: true, created_at: true },
  },
} as const