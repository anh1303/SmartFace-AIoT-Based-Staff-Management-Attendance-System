type BiometricsPort = Pick<typeof import('../biometrics/public.js'), 'hasFaceLoginTemplate' | 'findBestFaceMatch'>
let biometrics: BiometricsPort | undefined
export function configureAuthBiometrics(port: BiometricsPort) { biometrics = port }
export function authBiometrics(): BiometricsPort {
  if (!biometrics) throw new Error('Authentication biometric integration is not configured')
  return biometrics
}
