import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Video,
  VideoOff,
  Maximize2,
  RefreshCw,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '../../../api/client';

interface WebRTCPlayerProps {
  streamUrl?: string; // e.g. http://10.52.138.36:8889/pi4_cam/whep
  deviceId?: string;
  deviceName?: string;
  currentMode?: 'CHECK_IN' | 'CHECK_OUT' | null;
  onModeChange?: (newMode: 'CHECK_IN' | 'CHECK_OUT') => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
  streamUrl = (import.meta.env.VITE_MEDIAMTX_WHEP_URL || `http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '192.168.1.170'}:8889/pi4_cam/whep`),
  deviceId = 'PI4_FRONT_GATE',
  deviceName = 'Cổng Chính — Raspberry Pi 4 Edge',
  currentMode = null,
  onModeChange,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionUrlRef = useRef<string | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [iceState, setIceState] = useState<RTCIceConnectionState>('new');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Không mặc định Pi luôn là CHECK_IN; khởi tạo theo prop hoặc null (CHƯA XÁC NHẬN)
  const [activeMode, setActiveMode] = useState<'CHECK_IN' | 'CHECK_OUT' | null>(currentMode || null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const isLive = iceState === 'connected' || iceState === 'completed';

  // Đọc lại chế độ thực tế của thiết bị từ Backend
  const fetchDeviceRealMode = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/devices/${deviceId}/mode`);
      if (res.success && res.data?.confirmed === true && res.data?.mode) {
        setActiveMode(res.data.mode);
        onModeChange?.(res.data.mode);
      } else {
        // Chưa được Pi xác nhận
        setActiveMode(null);
      }
    } catch {
      setActiveMode(null);
    }
  }, [deviceId, onModeChange]);

  // Khi prop currentMode thay đổi từ bên ngoài
  useEffect(() => {
    if (currentMode !== undefined) {
      setActiveMode(currentMode);
    }
  }, [currentMode]);

  // Lắng nghe sự kiện đổi chế độ và reconnect từ Socket.IO
  useEffect(() => {
    const socketBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const socket = io(`${socketBase}/attendance`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      // Khi vừa kết nối hoặc reconnect: đọc lại mode thực tế từ Pi
      fetchDeviceRealMode();
    });
    socket.on('device-mode-changed', (data: any) => {
      if (data && (data.deviceId === deviceId || data.deviceId === 'PI4_FRONT_GATE')) {
        if (data.confirmed === true && (data.mode === 'CHECK_IN' || data.mode === 'CHECK_OUT')) {
          setActiveMode(data.mode);
          onModeChange?.(data.mode);
          showToast?.(
            `Cổng đã xác nhận chế độ: ${data.mode === 'CHECK_IN' ? 'VÀO CA (Check-in)' : 'TAN CA (Check-out)'}`,
            'info'
          );
        } else if (data.confirmed === false) {
          setActiveMode(null);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceId, fetchDeviceRealMode, onModeChange, showToast]);

  const stopConnection = useCallback(() => {
    // 1. Hủy request in-flight nếu đang kết nối
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Xóa timeout kết nối
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // 3. Giải phóng phiên WHEP trên MediaMTX Server qua HTTP DELETE nếu có URL session
    if (sessionUrlRef.current) {
      const urlToDelete = sessionUrlRef.current;
      sessionUrlRef.current = null;
      fetch(urlToDelete, { method: 'DELETE', keepalive: true }).catch(() => {});
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIceState('closed');
    setIsConnecting(false);
  }, []);

  const startConnection = useCallback(async () => {
    stopConnection();
    setIsConnecting(true);
    setErrorMsg(null);
    setIceState('new');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Timeout thiết lập kết nối WebRTC (12 giây)
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isLive) {
        setErrorMsg('Quá thời gian kết nối tới luồng WebRTC (Connection Timeout).');
        stopConnection();
      }
    }, 12000);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsConnecting(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        setIceState(pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnecting(false);
          setErrorMsg(null);
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setErrorMsg('Mất kết nối luồng WebRTC từ camera Edge.');
          setIsConnecting(false);
        }
      };

      // Tạo Offer SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Thu thập ICE Candidate trước khi gửi offer SDP lên WHEP server
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkIce = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkIce);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkIce);
          setTimeout(resolve, 1500); // Tối đa 1.5s thu thập ICE
        }
      });

      if (abortController.signal.aborted) return;

      const sdpToSend = pc.localDescription?.sdp || offer.sdp;
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: sdpToSend,
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`MediaMTX WHEP phản hồi mã ${res.status} (${res.statusText})`);
      }

      // Lưu lại Location Header để giải phóng phiên (WHEP RFC session termination)
      const locationHeader = res.headers.get('Location');
      if (locationHeader) {
        sessionUrlRef.current = new URL(locationHeader, streamUrl).toString();
      }

      const answerSdp = await res.text();
      if (abortController.signal.aborted) return;

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      stopConnection();
      setErrorMsg(err.message || 'Không thể kết nối luồng WebRTC');
      setIsConnecting(false);
      setIceState('failed');
    }
  }, [streamUrl, isLive, stopConnection]);

  useEffect(() => {
    startConnection();
    return () => {
      stopConnection();
    };
  }, [startConnection, stopConnection]);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Sửa mode API sang PATCH theo route backend; chỉ hiển thị thành công khi có confirmed=true từ ACK của Pi
  const handleSwitchMode = async (mode: 'CHECK_IN' | 'CHECK_OUT') => {
    if (isSwitchingMode || activeMode === mode) return;
    setIsSwitchingMode(true);
    try {
      const res = await apiFetch(`/api/devices/${deviceId}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      });
      if (res.success && res.data?.confirmed && res.data?.mode === mode) {
        setActiveMode(mode);
        onModeChange?.(mode);
        showToast?.(`Đã đổi chế độ sang ${mode === 'CHECK_IN' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}`, 'success');
      } else {
        // Lệnh đã gửi nhưng Pi chưa xác nhận
        showToast?.(
          res.message || 'Lệnh đã gửi nhưng Raspberry Pi chưa phản hồi xác nhận (ACK). Vui lòng kiểm tra thiết bị.',
          'warning'
        );
      }
    } catch (err: any) {
      showToast?.(`Lỗi chuyển chế độ: ${err.message}`, 'error');
    } finally {
      setIsSwitchingMode(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/60 shadow-xl transition-all"
    >
      {/* Top Header Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            {isLive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            )}
          </span>
          <span className="text-xs font-semibold tracking-wide text-white uppercase flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-400' : 'text-slate-400'}`} />
            {isLive ? 'LIVE WEBRTC' : isConnecting ? 'CONNECTING...' : 'OFFLINE'}
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-300/80 font-mono">
            | {deviceName}
          </span>
        </div>

        {/* Remote Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800/90 backdrop-blur-md rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              disabled={isSwitchingMode}
              onClick={() => handleSwitchMode('CHECK_IN')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                activeMode === 'CHECK_IN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VÀO CA
            </button>
            <button
              type="button"
              disabled={isSwitchingMode}
              onClick={() => handleSwitchMode('CHECK_OUT')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                activeMode === 'CHECK_OUT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TAN CA
            </button>
          </div>

          <button
            type="button"
            onClick={startConnection}
            title="Làm mới kết nối"
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-all border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title="Xem toàn màn hình"
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-all border border-slate-700"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Element Viewport */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain transition-opacity duration-500 ${
            isLive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Offline / Connecting / Error State Overlay */}
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
            {isConnecting ? (
              <>
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-200">Đang thiết lập kênh WebRTC tới MediaMTX...</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{streamUrl}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                  <VideoOff className="w-6 h-6 text-red-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200 mb-1">Chưa thể kết nối tới Camera Edge</h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  {errorMsg || 'Vui lòng kiểm tra Raspberry Pi đã chạy lệnh "python edge_client.py" và MediaMTX Server đang mở.'}
                </p>
                <button
                  type="button"
                  onClick={startConnection}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Thử kết nối lại
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Info Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Video className="w-3.5 h-3.5 text-blue-400" />
            Kênh: <span className="text-emerald-400 font-mono">WebRTC WHEP ({iceState.toUpperCase()})</span>
          </span>
          <span className="hidden md:inline-block">|</span>
          <span className="hidden md:flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            AI Pipeline: <span className="text-slate-200 font-mono">SCRFD + MiniFASNet R7 + ArcFace</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Chế độ hiện tại:</span>
          <span
            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
              activeMode === 'CHECK_IN'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : activeMode === 'CHECK_OUT'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-700/40 text-slate-400 border border-slate-600/50'
            }`}
          >
            {activeMode === 'CHECK_IN' ? 'CHECK-IN' : activeMode === 'CHECK_OUT' ? 'CHECK-OUT' : 'CHƯA XÁC NHẬN'}
          </span>
        </div>
      </div>
    </div>
  );
};
