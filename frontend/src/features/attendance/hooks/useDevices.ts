import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';

export interface DeviceInfo {
  name: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE';
}

const DEFAULT_DEVICES: DeviceInfo[] = [
  { name: 'FaceCam-01', location: 'Cổng chính - Tầng 1', status: 'ONLINE' },
  { name: 'FaceCam-02', location: 'Cổng phòng R&D - Tầng 2', status: 'ONLINE' },
  { name: 'Fingerprint-01', location: 'Máy chấm công vân tay Cổng A', status: 'ONLINE' },
  { name: 'Fingerprint-02', location: 'Máy chấm công vân tay Cổng B', status: 'ONLINE' },
];

export function useDevices() {
  const query = useQuery<DeviceInfo[]>({
    queryKey: ['devices'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/devices');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((d: { name?: string; location?: string; status?: string }) => ({
            name: d.name || 'Device',
            location: d.location || 'Khu vực',
            status: (d.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE') as 'ONLINE' | 'OFFLINE',
          }));
        }
      } catch {
        // Fallback to default list if api not available
      }
      return DEFAULT_DEVICES;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    devices: query.data || DEFAULT_DEVICES,
    isLoading: query.isLoading,
  };
}
