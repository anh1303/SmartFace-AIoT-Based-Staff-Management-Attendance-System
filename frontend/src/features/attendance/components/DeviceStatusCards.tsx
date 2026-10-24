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
            className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-[#2f3668] transition-all shadow-xs"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {isFingerprint ? (
                    <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ScanFace className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  )}
                  {dev.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{dev.location}</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {dev.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

