import React from 'react';
import { ScanFace, Fingerprint } from 'lucide-react';
import { DeviceInfo } from '../hooks/useDevices';

interface DeviceStatusCardsProps {
  devices: DeviceInfo[];
}

export const DeviceStatusCards: React.FC<DeviceStatusCardsProps> = ({ devices }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {devices.map((dev) => {
        const isFingerprint =
          dev.name.toLowerCase().includes('fingerprint') ||
          dev.name.toLowerCase().includes('fp') ||
          dev.location.toLowerCase().includes('vân tay');

        return (
          <div
            key={dev.name}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  {isFingerprint ? (
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ScanFace className="w-4 h-4 text-blue-400" />
                  )}
                  {dev.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{dev.location}</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                {dev.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
