import React from 'react';
import {
  CheckCircle2,
  LogOut,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { LiveAttendanceEvent } from '../hooks/useAttendanceSocket';

interface LiveEventFeedProps {
  events: LiveAttendanceEvent[];
  onClear: () => void;
  isSocketConnected: boolean;
}

export const LiveEventFeed: React.FC<LiveEventFeedProps> = ({
  events,
  onClear,
  isSocketConnected,
}) => {
  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Dòng Sự Kiện Thời Gian Thực
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isSocketConnected ? 'Đã kết nối Socket.IO' : 'Đang kết nối lại...'}
            </p>
          </div>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-all"
            title="Xóa danh sách"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[380px]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500">
            <Clock className="w-8 h-8 mb-2 opacity-40 animate-pulse" />
            <p className="text-xs font-medium">Đang chờ lượt quét khuôn mặt từ camera...</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
              Dữ liệu điểm danh từ Raspberry Pi sẽ xuất hiện tự động tại đây ngay lập tức.
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const isCheckIn = evt.type === 'CHECK_IN';
            const isCheckOut = evt.type === 'CHECK_OUT';
            const isUnknown = evt.type === 'UNKNOWN';
            const isSpoof = evt.type === 'SPOOF_BLOCKED';

            let badgeBg = 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            let icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            let title = 'VÀO CA THÀNH CÔNG';

            if (isCheckOut) {
              badgeBg = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
              icon = <LogOut className="w-4 h-4 text-amber-500" />;
              title = 'TAN CA THÀNH CÔNG';
            } else if (isUnknown) {
              badgeBg = 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
              icon = <AlertTriangle className="w-4 h-4 text-yellow-500" />;
              title = 'NGƯỜI LẠ CHƯA ĐĂNG KÝ';
            } else if (isSpoof) {
              badgeBg = 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
              icon = <ShieldAlert className="w-4 h-4 text-red-500" />;
              title = 'CHẶN GIẢ MẠO (SPOOF)';
            }

            return (
              <div
                key={evt.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/70"
              >
                <div className="flex-shrink-0">{icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {evt.employeeName || (isUnknown ? 'Chưa xác định' : 'Cảnh báo giả mạo')}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{evt.time}</span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {evt.employeeCode ? `Mã: ${evt.employeeCode} • ` : ''}
                    {evt.message}
                  </p>
                </div>

                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${badgeBg}`}>
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
