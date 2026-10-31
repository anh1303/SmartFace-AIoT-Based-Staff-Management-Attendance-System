import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
export function useDeviceRealtime() {
    const client = useQueryClient();
    useEffect(() => {
        if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true')
            return;
        const base = import.meta.env.VITE_SOCKET_URL || window.location.origin;
        const socket = io(`${base}/devices`, { withCredentials: true });
        const refresh = () => {
            client.invalidateQueries({ queryKey: ['devices'] });
            client.invalidateQueries({ queryKey: ['device'] });
            client.invalidateQueries({ queryKey: ['deviceMode'] });
        };
        socket.on('mode-changed', (payload: any) => {
            if (payload && payload.mode) {
                client.setQueriesData({ queryKey: ['deviceMode'] }, (old: any) => ({
                    ...(old || {}),
                    deviceId: old?.deviceId || payload.id || 'PI4_FRONT_GATE',
                    mode: payload.mode,
                    confirmed: payload.confirmed ?? true,
                    lastUpdated: new Date().toISOString(),
                }));
            }
            refresh();
        });
        for (const event of ['connect', 'created', 'updated', 'deleted', 'status'])
            socket.on(event, refresh);
        return () => {
            socket.disconnect();
        };
    }, [client]);
}
