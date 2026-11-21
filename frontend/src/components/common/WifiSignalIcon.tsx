import { Wifi, WifiHigh, WifiLow, WifiZero } from 'lucide-react';

interface WifiSignalIconProps {
  signal: number;
  className?: string;
}

export const WifiSignalIcon = ({ signal, className = 'w-4 h-4 shrink-0' }: WifiSignalIconProps) => {
  if (signal >= 75) return <Wifi className={`${className} text-emerald-500`} />;
  if (signal >= 50) return <WifiHigh className={`${className} text-emerald-500 dark:text-emerald-400`} />;
  if (signal >= 25) return <WifiLow className={`${className} text-amber-500`} />;
  return <WifiZero className={`${className} text-rose-500`} />;
};
