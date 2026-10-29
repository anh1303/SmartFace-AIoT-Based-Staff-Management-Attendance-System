import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';

export interface DeviceInfo {
  name: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
}

export function useDevices(enabled = true) {
  const query = useQuery<DeviceInfo[]>({
    queryKey: ['devices'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch('/api/devices');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map((d: { name?: string; location?: string; status?: string }) => ({
          name: d.name || 'Device',
          location: d.location || 'Khu vực',
          status: (d.status === 'MAINTENANCE' ? 'MAINTENANCE' : d.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE') as DeviceInfo['status'],
        }));
      }
      return [];
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  return {
    devices: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
