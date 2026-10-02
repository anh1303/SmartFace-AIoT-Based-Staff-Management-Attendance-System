/**
 * Application environment configuration
 */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, ''),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  appName: 'SmartFace AIoT Attendance System',
  version: '1.0.0',
} as const;
