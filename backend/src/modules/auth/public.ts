/**
 * Auth Module Public Contract
 */
export { requirePasswordAuth } from './face-login/require-password.js'
export { faceSessionAllowed } from './face-login/face-login.policy.js'
export { readAuthUser } from './auth.read.js'
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
  assertFaceSession,
  findActiveAdminUserIds,
  findActiveManagerAndAdminUserIds,
  findActiveManagerUserIdsByDepartment,
  findActiveAlertRecipients,
  type ActiveAlertRecipient,
} from './auth.service.js'

