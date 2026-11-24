/**
 * Auth Module Public Contract
 */
export { requirePasswordAuth } from './face-login/require-password.js'
export { faceSessionAllowed } from './face-login/face-login.policy.js'
export { readAuthUser, readAuthUsers, type AuthScopeUser } from './auth.read.js'
export { generateRandomPassword } from './password.utils.js'
export {
  findAuthUserByUsername,
  findAuthUserById,
  createAuthUser,
  updateAuthUser,
  getDefaultRole,
  getRoleByName,
  deleteAuthUser,
  verifyAndLoadActiveUser,
  evaluateActiveSession,
  resolveActiveSession,
  resolveActiveSessionsBatch,
  assertFaceSession,
  findActiveAdminUserIds,
  findActiveManagerAndAdminUserIds,
  findActiveManagerUserIdsByDepartment,
  findActiveAlertRecipients,
  type ActiveAlertRecipient,
  type ActiveAuthUser,
  type ActiveSessionClaims,
  type ActiveSessionFailureReason,
  type ActiveSessionResult,
  type ActiveSessionSocketScope,
} from './auth.service.js'

