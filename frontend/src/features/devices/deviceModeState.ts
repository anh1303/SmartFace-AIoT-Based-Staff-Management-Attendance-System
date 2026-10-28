import type { AttendanceMode, DeviceMode } from './deviceApi';
/** A cached observation predating the request cannot confirm the new command. */
export function confirmsRequestedMode(observed: DeviceMode | undefined, requested: {
    mode: AttendanceMode;
    time: number;
} | null): boolean { return !!requested && !!observed?.confirmed && observed.mode === requested.mode && !!observed.lastUpdated && Date.parse(observed.lastUpdated) >= requested.time; }
