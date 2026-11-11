type EmployeeIntegration = Pick<typeof import('../auth/public.js'), 'findAuthUserByUsername' | 'createAuthUser' | 'updateAuthUser' | 'getDefaultRole' | 'deleteAuthUser'>
  & Pick<typeof import('../biometrics/public.js'), 'deleteBiometricsForEmployee'>
  & Pick<typeof import('../shifts/public.js'), 'deleteShiftsForEmployee'>
  & Pick<typeof import('../attendance/public.js'), 'hasAttendanceActivity'>
  & Pick<typeof import('../payroll/public.js'), 'hasPayrollActivity'>

let integration: EmployeeIntegration | undefined
export function configureEmployeeIntegration(port: EmployeeIntegration) { integration = port }
export function employeeIntegration(): EmployeeIntegration {
  if (!integration) throw new Error('Employee integration is not configured')
  return integration
}
