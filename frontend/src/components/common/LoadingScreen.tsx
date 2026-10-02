import React from 'react';
import { ScanFace } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Đang đồng bộ phiên làm việc...',
  subMessage = 'Bảo mật AES-256 • Xác thực thời gian thực',
  fullScreen = true,
}) => {
  return (
    <div
      className={`bg-slate-950 flex flex-col items-center justify-center text-slate-200 ${
        fullScreen ? 'min-h-screen w-full fixed inset-0 z-50' : 'py-20 w-full'
      }`}
    >
      {/* Background glow */}
      <div className="absolute w-72 h-72 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Cyberpunk Scan Graphic */}
      <div className="relative w-20 h-20 flex items-center justify-center mb-6">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 rounded-2xl border border-blue-500/30 animate-ping opacity-60 pointer-events-none" />
        {/* Rotating ring */}
        <div className="w-16 h-16 rounded-2xl border-2 border-slate-800 border-t-blue-500 border-r-cyan-400 animate-spin" />
        {/* Inner Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ScanFace className="w-7 h-7 text-blue-400 animate-pulse" />
        </div>
      </div>

      {/* Text Info */}
      <div className="relative z-10 text-center space-y-2">
        <h3 className="text-sm font-heading font-semibold text-white tracking-wide">
          {message}
        </h3>
        {subMessage && (
          <p className="text-[11px] font-mono text-slate-500 tracking-wider uppercase">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
};
