import { env } from '../../config/env.js'

type EmployeeIntegration = Pick<typeof import('../auth/public.js'), 'findAuthUserByUsername' | 'createAuthUser' | 'updateAuthUser' | 'getDefaultRole' | 'deleteAuthUser' | 'generateRandomPassword'>
  & Pick<typeof import('../biometrics/public.js'), 'deleteBiometricsForEmployee' | 'faceEnrollmentSummarySelect' | 'hasActiveFaceEnrollment'>
  & Pick<typeof import('../shifts/public.js'), 'deleteShiftsForEmployee'>
  & Pick<typeof import('../attendance/public.js'), 'hasAttendanceActivity'>
  & Pick<typeof import('../payroll/public.js'), 'hasPayrollActivity'>

const fallbackFaceEnrollmentSummarySelect = {
  where: {
    is_active: true,
    embedding_type: 'CENTROID',
    model_version: env.FACE_AUTH_MODEL_VERSION,
  },
  select: {
    id: true,
    model_version: true,
    sample_tag: true,
    quality_score: true,
    created_at: true,
  },
} as const

let integration: EmployeeIntegration | undefined
export function configureEmployeeIntegration(port: EmployeeIntegration) { integration = port }
export function employeeIntegration(): EmployeeIntegration {
  if (!integration) throw new Error('Employee integration is not configured')
  return integration
}

export function faceEnrollmentSummarySelect() {
  return integration?.faceEnrollmentSummarySelect ?? fallbackFaceEnrollmentSummarySelect
}

export function hasActiveFaceEnrollment(faceEmbeddings: unknown[] | null | undefined): boolean {
  if (integration?.hasActiveFaceEnrollment) {
    return integration.hasActiveFaceEnrollment(faceEmbeddings)
  }
  return Array.isArray(faceEmbeddings) && faceEmbeddings.length > 0
}
