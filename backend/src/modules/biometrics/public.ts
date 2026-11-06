/**
 * Biometrics Module Public Contract
 */
export { hasFaceLoginTemplate } from './face-login.repository.js'
export {
  deleteBiometricsForEmployee,
  findBestFaceMatch,
  type FaceMatchCandidate,
} from './biometric.service.js'
