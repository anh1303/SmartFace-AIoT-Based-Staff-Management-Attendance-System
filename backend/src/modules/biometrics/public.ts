/**
 * Biometrics Module Public Contract
 */
export { faceEnrollmentSummarySelect, hasActiveFaceEnrollment } from './face-enrollment-status.js'
export { hasFaceLoginTemplate } from './face-login.repository.js'
export {
  deleteBiometricsForEmployee,
  findBestFaceMatch,
  type FaceMatchCandidate,
} from './biometric.service.js'
