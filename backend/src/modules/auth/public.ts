/**
 * Auth Module Public Contract
 */
export {
  findAuthUserByUsername,
  findAuthUserById,
  createAuthUser,
  updateAuthUser,
  getDefaultRole,
  getRoleByName,
  deleteAuthUser,
  verifyAndLoadActiveUser,
  findActiveAdminUserIds,
  findActiveManagerAndAdminUserIds,
  findActiveManagerUserIdsByDepartment,
  findActiveAlertRecipients,
  type ActiveAlertRecipient,
} from './auth.service.js'

