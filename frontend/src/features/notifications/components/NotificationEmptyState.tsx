import React from 'react';
import { BellOff, CheckCheck } from 'lucide-react';

interface NotificationEmptyStateProps {
  onDismiss?: () => void;
}

export const NotificationEmptyState: React.FC<NotificationEmptyStateProps> = () => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111425] text-slate-100 rounded-xl border border-slate-800 shadow-inner select-none transition-all">
      <div className="flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase font-mono">
          NO NEW NOTIFICATIONS
        </span>
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <span title="Không có thông báo mới" className="p-1 text-slate-400 hover:text-slate-200 transition-colors">
          <BellOff className="w-4 h-4 text-slate-400" />
        </span>
        <span title="Hệ thống đã cập nhật" className="p-1 text-slate-500">
          <CheckCheck className="w-4 h-4 text-emerald-400" />
        </span>
      </div>
    </div>
  );
};
