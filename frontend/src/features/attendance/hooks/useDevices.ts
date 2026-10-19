import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';

export interface DeviceInfo {
  name: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE';
}

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
      return [];
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

  return {
    devices: query.data || [],
    isLoading: query.isLoading,
  };
}
