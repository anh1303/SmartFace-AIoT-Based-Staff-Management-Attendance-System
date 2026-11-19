import React from 'react';
import {
  Clock,
  Sparkles,
} from 'lucide-react';
import { LiveAttendanceEvent } from '../hooks/useAttendanceSocket';

interface LiveEventFeedProps {
  events: LiveAttendanceEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const LiveEventFeed: React.FC<LiveEventFeedProps> = ({
  events,
  isLoading,
  isError,
  onRetry,
}) => {
  const attendanceEvents = events.filter(event => event.type === 'CHECK_IN' || event.type === 'CHECK_OUT');
  return (
    <div className="flex flex-col h-[500px] lg:h-[560px] min-h-0 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Nhật ký chấm công hôm nay
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {attendanceEvents.length} lượt vào / ra
            </p>
          </div>
        </div>

      </div>

      {/* Events List */}
      <div role="log" aria-label="Nhật ký chấm công hôm nay" tabIndex={0} className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] p-3 space-y-2.5">
        {isError && <div role="alert" className="p-2 text-xs text-amber-700 dark:text-amber-300">Chưa tải được đầy đủ nhật ký hôm nay. <button type="button" onClick={onRetry} className="underline cursor-pointer">Thử tải lại</button></div>}
        {isLoading && <p role="status" className="p-2 text-xs text-slate-500 dark:text-slate-400">Đang tải nhật ký hôm nay...</p>}
        {attendanceEvents.length === 0 ? (!isLoading && !isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500">
            <Clock className="w-8 h-8 mb-2 opacity-40 animate-pulse" />
            <p className="text-xs font-medium">Chưa có lượt chấm công nào hôm nay.</p>
          </div>
        )) : (
          attendanceEvents.map((evt) => {
            const isCheckOut = evt.type === 'CHECK_OUT';

            let badgeBg = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            let title = 'VÀO CA THÀNH CÔNG';

            if (isCheckOut) {
              badgeBg = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
              title = 'TAN CA THÀNH CÔNG';
            }

            return (
              <div
                key={evt.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/70"
              >
                <div className="min-w-0">
                    <p title={evt.employeeName} className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {evt.employeeName || 'Nhân viên'}
                    </p>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {evt.employeeCode || '—'}
                  </p>
                </div>

                <time dateTime={evt.timestamp} className="text-[10px] font-mono tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400">{evt.time}</time>

                <span className={`shrink-0 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${badgeBg}`}>
                  {title}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
