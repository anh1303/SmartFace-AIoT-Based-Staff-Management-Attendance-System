export function faceSessionAllowed(amr: unknown, role: string, enabled: boolean) {
  if (!Array.isArray(amr) || !amr.includes('face')) return true
  return enabled && role.toUpperCase() === 'EMPLOYEE'
}
