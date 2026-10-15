import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Video,
  VideoOff,
  Maximize2,
  RefreshCw,
  Radio,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../../api/client';

interface WebRTCPlayerProps {
  streamUrl?: string; // e.g. http://10.52.138.36:8889/pi4_cam/whep
  deviceId?: string;
  deviceName?: string;
  currentMode?: 'CHECK_IN' | 'CHECK_OUT';
  onModeChange?: (newMode: 'CHECK_IN' | 'CHECK_OUT') => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
  streamUrl = (import.meta.env.VITE_MEDIAMTX_WHEP_URL || 'http://10.52.138.36:8889/pi4_cam/whep'),
  deviceId = 'PI4_FRONT_GATE',
  deviceName = 'Cổng Chính — Raspberry Pi 4 Edge',
  currentMode = 'CHECK_IN',
  onModeChange,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'CHECK_IN' | 'CHECK_OUT'>(currentMode);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  useEffect(() => {
    setActiveMode(currentMode);
  }, [currentMode]);

  // Lắng nghe sự kiện đổi chế độ từ Socket.IO (khi đổi từ ThingsBoard hoặc thiết bị khác)
  useEffect(() => {
    const socketBase = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const socket = io(`${socketBase}/attendance`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('device-mode-changed', (data: any) => {
      if (data && (data.deviceId === deviceId || data.deviceId === 'PI4_FRONT_GATE')) {
        if (data.mode === 'CHECK_IN' || data.mode === 'CHECK_OUT') {
          setActiveMode(data.mode);
          onModeChange?.(data.mode);
          showToast?.(
            `Cổng vừa đổi chế độ: ${data.mode === 'CHECK_IN' ? 'VÀO CA (Check-in)' : 'TAN CA (Check-out)'}`,
            'info'
          );
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [deviceId, onModeChange, showToast]);

  const stopConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const startConnection = useCallback(async () => {
    stopConnection();
    setIsConnecting(true);
    setErrorMsg(null);

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
          setIsConnected(true);
          setIsConnecting(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setIsConnected(false);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!res.ok) {
        throw new Error(`MediaMTX WHEP phản hồi mã ${res.status} (${res.statusText})`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối luồng WebRTC');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [streamUrl, stopConnection]);

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

  const handleSwitchMode = async (mode: 'CHECK_IN' | 'CHECK_OUT') => {
    if (isSwitchingMode || activeMode === mode) return;
    setIsSwitchingMode(true);
    try {
      const res = await apiFetch(`/api/devices/${deviceId}/mode`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      if (res.success || res.data) {
        setActiveMode(mode);
        onModeChange?.(mode);
        showToast?.(`Đã đổi chế độ sang ${mode === 'CHECK_IN' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}`, 'success');
      } else {
        throw new Error(res.message || 'Lỗi gửi lệnh chuyển chế độ');
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
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            )}
          </span>
          <span className="text-xs font-semibold tracking-wide text-white uppercase flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            {isConnected ? 'LIVE WEBRTC' : isConnecting ? 'CONNECTING...' : 'OFFLINE'}
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
            isConnected ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Offline / Connecting / Error State Overlay */}
        {!isConnected && (
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
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2"
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
            Độ trễ: <span className="text-emerald-400 font-mono">&lt; 150ms</span>
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
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {activeMode === 'CHECK_IN' ? 'CHECK-IN' : 'CHECK-OUT'}
          </span>
        </div>
      </div>
    </div>
  );
};
