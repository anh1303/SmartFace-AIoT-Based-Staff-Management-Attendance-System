/**
 * Application environment configuration
 */
export function parseIotHardwareEnabled(raw: unknown): boolean {
  if (typeof raw !== 'string') return true;
  return raw.trim().toLowerCase() !== 'false';
}

export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, ''),
  iotHardwareEnabled: parseIotHardwareEnabled(import.meta.env.VITE_IOT_HARDWARE_ENABLED),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  appName: 'SmartFace AIoT Attendance System',
  version: '1.0.0',
};
