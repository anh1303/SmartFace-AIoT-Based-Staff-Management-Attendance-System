import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiFetch } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';

export interface DeviceSettings {
  deviceId: string;
  online: boolean;
  fps: number;
  volume: number; // 0 - 100
  isMuted: boolean;
  showFps: boolean;
  streamEnabled: boolean;
  maxFaces: number; // 1 - 10 (MAX_FACES_PER_FRAME)
  wifi: {
    connected: boolean;
    ssid: string;
    signalStrength: number; // 0 - 100 %
    ip: string;
  };
  bluetooth: {
    connected: boolean;
    deviceName: string;
    status: 'connected' | 'disconnected';
  };
  lastUpdated?: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  connected: boolean;
}

export interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
  paired: boolean;
}

const DEFAULT_SETTINGS: DeviceSettings = {
  deviceId: 'PI4_FRONT_GATE',
  online: false,
  fps: 0,
  volume: 75,
  isMuted: false,
  showFps: true,
  streamEnabled: true,
  maxFaces: 3,
  wifi: {
    connected: false,
    ssid: '',
    signalStrength: 0,
    ip: '',
  },
  bluetooth: {
    connected: false,
    deviceName: '',
    status: 'disconnected',
  },
};

/**
 * Web Audio API synthesizer chime:
 * Tự động tạo âm thanh 2 nốt Đô-Mi (C5-E5) trong trẻo, nhẹ nhàng
 * trực tiếp trên loa máy tính Web mà không cần tải file mp3 phụ.
 */
export const playBrowserChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Nốt thứ nhất: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Nốt thứ hai: E5 (659.25 Hz) - tạo âm vang xác nhận điểm danh
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[WebAudio] Không thể phát chuông trình duyệt:', err);
  }
};

export function useDeviceSettings(deviceId = 'PI4_FRONT_GATE') {
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'manager';

  const [settings, setSettings] = useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // 1. Tải cài đặt từ Backend
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<DeviceSettings>(`/api/devices/${deviceId}/settings`);
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.warn('[useDeviceSettings] Dùng fallback mặc định do lỗi fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchSettings();
    const pollTimer = setInterval(() => {
      fetchSettings();
    }, 5000);
    return () => clearInterval(pollTimer);
  }, [fetchSettings]);

  // 2. Lắng nghe cập nhật thời gian thực từ Socket.IO (/attendance)
  useEffect(() => {
    const socketBase =
      import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    const socket = io(`${socketBase}/attendance`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('device-settings-changed', (incoming: DeviceSettings) => {
      if (incoming && (incoming.deviceId === deviceId || incoming.deviceId === 'PI4_FRONT_GATE')) {
        setSettings((prev) => ({
          ...prev,
          ...incoming,
          wifi: { ...prev.wifi, ...(incoming.wifi || {}) },
          bluetooth: { ...prev.bluetooth, ...(incoming.bluetooth || {}) },
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceId]);

  // 3. Cập nhật cấu hình xuống backend (Optimistic UI)
  const patchSettings = useCallback(
    async (patch: Partial<DeviceSettings>) => {
      // Optimistic update
      setSettings((prev) => ({
        ...prev,
        ...patch,
        wifi: patch.wifi ? { ...prev.wifi, ...patch.wifi } : prev.wifi,
        bluetooth: patch.bluetooth ? { ...prev.bluetooth, ...patch.bluetooth } : prev.bluetooth,
      }));

      try {
        setIsUpdating(true);
        await apiFetch(`/api/devices/${deviceId}/settings`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
      } catch (err) {
        console.error('[useDeviceSettings] Lỗi khi cập nhật cài đặt:', err);
        // Rollback nếu cần
        fetchSettings();
      } finally {
        setIsUpdating(false);
      }
    },
    [deviceId, fetchSettings]
  );

  // 4. Điều chỉnh âm lượng có Debounce để kéo thanh trượt mượt mà
  const setVolume = useCallback(
    (newVolume: number) => {
      const vol = Math.max(0, Math.min(100, Math.round(newVolume)));
      // Cập nhật state UI ngay lập tức
      setSettings((prev) => ({ ...prev, volume: vol, isMuted: vol === 0 ? true : prev.isMuted }));

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        patchSettings({ volume: vol, isMuted: vol === 0 });
      }, 180);
    },
    [patchSettings]
  );

  // 5. Toggle Mute
  const toggleMute = useCallback(() => {
    const nextMuted = !settings.isMuted;
    patchSettings({ isMuted: nextMuted });
  }, [settings.isMuted, patchSettings]);

  // 6. Toggle FPS LCD
  const toggleFps = useCallback(() => {
    const nextFps = !settings.showFps;
    patchSettings({ showFps: nextFps });
  }, [settings.showFps, patchSettings]);

  // 7. Toggle Camera Stream
  const toggleStream = useCallback(() => {
    const nextStream = !settings.streamEnabled;
    patchSettings({ streamEnabled: nextStream });
  }, [settings.streamEnabled, patchSettings]);

  // 7b. Cập nhật số khuôn mặt được nhận diện tối đa trên 1 khung hình (MAX_FACES_PER_FRAME)
  const setMaxFaces = useCallback(
    (count: number) => {
      const clamped = Math.max(1, Math.min(10, Math.round(count)));
      patchSettings({ maxFaces: clamped });
    },
    [patchSettings]
  );

  // 8. Test âm thanh (Gửi lệnh xuống loa/tai nghe Bluetooth của Raspberry Pi)
  const testAudio = useCallback(async () => {
    try {
      await apiFetch(`/api/devices/${deviceId}/actions/test-audio`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[useDeviceSettings] Gửi test audio xuống thiết bị:', err);
    }
  }, [deviceId]);

  // 9. Kết nối lại loa Bluetooth
  const reconnectBluetooth = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await apiFetch<DeviceSettings['bluetooth']>(
        `/api/devices/${deviceId}/actions/bluetooth-reconnect`,
        { method: 'POST' }
      );
      if (res.success && res.data) {
        setSettings((prev) => ({
          ...prev,
          bluetooth: { ...prev.bluetooth, ...res.data, connected: true, status: 'connected' },
        }));
      }
      return true;
    } catch (err) {
      console.error('[useDeviceSettings] Lỗi khi kết nối lại Bluetooth:', err);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [deviceId]);

  // 10. Quét mạng Wi-Fi
  const scanWifi = useCallback(async (): Promise<WifiNetwork[]> => {
    try {
      const res = await apiFetch<any>(`/api/devices/${deviceId}/actions/scan-wifi`, {
        method: 'POST',
      });
      if (res && res.success) {
        if (Array.isArray(res.data)) return res.data;
        if (res.data && Array.isArray(res.data.networks)) return res.data.networks;
      }
      return [];
    } catch (err) {
      console.error('[useDeviceSettings] Lỗi khi quét Wi-Fi:', err);
      return [];
    }
  }, [deviceId]);

  // 11. Quét loa Bluetooth
  const scanBluetooth = useCallback(async (): Promise<BluetoothDevice[]> => {
    try {
      const res = await apiFetch<any>(`/api/devices/${deviceId}/actions/scan-bluetooth`, {
        method: 'POST',
      });
      if (res && res.success) {
        if (Array.isArray(res.data)) return res.data;
        if (res.data && Array.isArray(res.data.devices)) return res.data.devices;
      }
      return [];
    } catch (err) {
      console.error('[useDeviceSettings] Lỗi khi quét Bluetooth:', err);
      return [];
    }
  }, [deviceId]);

  // 12. Thay đổi kết nối tới thiết bị loa Bluetooth khác
  const connectBluetooth = useCallback(
    async (device: BluetoothDevice): Promise<boolean> => {
      try {
        setIsUpdating(true);
        const res = await apiFetch<DeviceSettings['bluetooth']>(
          `/api/devices/${deviceId}/actions/bluetooth-connect`,
          {
            method: 'POST',
            body: JSON.stringify({ name: device.name, address: device.address }),
          }
        );
        if (res.success && res.data) {
          setSettings((prev) => ({
            ...prev,
            bluetooth: {
              ...prev.bluetooth,
              ...res.data,
              connected: true,
              deviceName: device.name,
              status: 'connected',
            },
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useDeviceSettings] Lỗi khi đổi thiết bị Bluetooth:', err);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [deviceId]
  );

  // 13. Ngắt kết nối thiết bị Bluetooth
  const disconnectBluetooth = useCallback(
    async (deviceAddr?: string): Promise<boolean> => {
      try {
        setIsUpdating(true);
        const res = await apiFetch<DeviceSettings['bluetooth']>(
          `/api/devices/${deviceId}/actions/bluetooth-disconnect`,
          {
            method: 'POST',
            body: JSON.stringify({ address: deviceAddr || '' }),
          }
        );
        if (res.success) {
          setSettings((prev) => ({
            ...prev,
            bluetooth: {
              connected: false,
              deviceName: '',
              status: 'disconnected',
            },
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useDeviceSettings] Lỗi khi ngắt kết nối Bluetooth:', err);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [deviceId]
  );

  return {
    canManage,
    settings,
    isLoading,
    isUpdating,
    fetchSettings,
    patchSettings,
    setVolume,
    toggleMute,
    toggleFps,
    toggleStream,
    setMaxFaces,
    testAudio,
    reconnectBluetooth,
    connectBluetooth,
    disconnectBluetooth,
    scanWifi,
    scanBluetooth,
  };
}
