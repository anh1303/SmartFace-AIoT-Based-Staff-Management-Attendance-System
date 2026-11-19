/**
 * Biometrics Module Public API (Facade)
 */
export * from './biometric.service.js'
export { biometricRouter } from './biometric.routes.js'
export { fingerprintDeviceRouter } from './fingerprint.routes.js'
export { initializeFingerprintGateway } from './fingerprint.gateway.js'
export { executeEnrollment } from './biometric.jobs.js'
