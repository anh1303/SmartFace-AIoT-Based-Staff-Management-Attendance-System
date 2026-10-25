import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { NotificationItem as NotificationItemType } from '../types/notification.types';
import { formatRelativeTime } from '../utils/timeAgo';

interface NotificationItemProps {
  item: NotificationItemType;
  onRemove: (id: string) => void;
  onMarkRead?: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  item,
  onRemove,
  onMarkRead,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExiting(true);
    setTimeout(() => {
      onRemove(item.id);
    }, 220); // Sync with CSS fade/slide duration
  };

  const handleClick = () => {
    if (!item.read && onMarkRead) {
      onMarkRead(item.id);
    }
  };

  // Determine icon & styling based on notification type
  let icon = <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
  let badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40';

  if (item.type === 'success') {
    icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40';
  } else if (item.type === 'error') {
    icon = <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
    badgeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40';
  } else if (item.type === 'warning') {
    icon = <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
    badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40';
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all duration-200 select-none cursor-pointer ${
        isExiting
          ? 'opacity-0 translate-x-4 scale-95 duration-200'
          : 'opacity-100 translate-x-0 scale-100'
      } ${
        item.read
          ? 'bg-white/60 dark:bg-[#12162a]/60 border-slate-200/70 dark:border-[#1d2243]/70 hover:bg-white dark:hover:bg-[#161a33]'
          : 'bg-white dark:bg-[#161a35] border-blue-200 dark:border-blue-900/60 shadow-xs hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {/* Unread Indicator Dot */}
      {!item.read && (
        <span className="absolute -left-1 top-4 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-white dark:ring-[#0f1224]" />
      )}

      {/* Main Content Area */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded-lg border shrink-0 ${badgeColor}`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`text-xs font-semibold truncate ${
                item.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'
              }`}
            >
              {item.title}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed break-words">
            {item.message}
          </p>
        </div>
      </div>

      {/* Nút X ở cuối để có thể xóa */}
      <button
        type="button"
        onClick={handleRemove}
        title="Xóa thông báo này"
        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
