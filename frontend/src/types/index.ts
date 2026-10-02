/**
 * Barrel re-export for domain TypeScript types.
 * Uses `export type *` to guarantee type erasure at compile-time and avoid circular runtime dependencies.
 */
export type * from './api.types';
export type * from './auth.types';
export type * from './employee.types';
export type * from './shift.types';
export type * from './attendance.types';
export type * from './payroll.types';
export type * from './biometric.types';
export type * from './common.types';