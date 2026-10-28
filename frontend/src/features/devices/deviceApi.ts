import { api } from '../../api/client';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
export type AttendanceMode = 'CHECK_IN' | 'CHECK_OUT';
export interface Device {
    id: string;
    name: string;
    location: string;
    ip: string | null;
    status: DeviceStatus;
    lastSeen: string | null;
    createdAt: string;
}
export interface DeviceMode {
    deviceId: string;
    mode: AttendanceMode | null;
    confirmed: boolean;
    lastUpdated?: string;
}
export interface DeviceInput {
    name: string;
    location: string;
    ip?: string | null;
    status?: DeviceStatus;
}
async function unwrap<T>(promise: Promise<{
    success: boolean;
    data?: T;
    message?: string;
}>): Promise<T> { const res = await promise; if (!res.success || res.data === undefined)
    throw new Error(res.message || 'Không thể thực hiện thao tác với thiết bị'); return res.data; }
const path = (id: string) => `/api/devices/${encodeURIComponent(id)}`;
export const deviceApi = { list: () => unwrap(api.get<Device[]>('/api/devices')), get: (id: string) => unwrap(api.get<Device>(path(id))), create: (input: DeviceInput) => unwrap(api.post<Device>('/api/devices', input)), update: (id: string, input: Partial<DeviceInput>) => unwrap(api.put<Device>(path(id), input)), remove: (id: string) => unwrap(api.delete<null>(path(id))), mode: (id: string) => unwrap(api.get<DeviceMode>(`${path(id)}/mode`)), setMode: (id: string, mode: AttendanceMode) => unwrap(api.patch<DeviceMode>(`${path(id)}/mode`, { mode })) };
export function validDeviceIp(value: string): boolean { if (!value)
    return true; if (value.includes(':')) {
    try {
        return new URL(`http://[${value}]/`).hostname.startsWith('[') && !value.includes('%');
    }
    catch {
        return false;
    }
} return /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value) && value.split('.').every(n => Number(n) <= 255); }
