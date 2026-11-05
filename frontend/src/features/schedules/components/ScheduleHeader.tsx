import { ReportExportButton, type ReportFormat } from '@/components/common/ReportExportButton';
import React from 'react';
import {
  Copy,
  Layers,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Calendar,
  CalendarDays,
  Download,
} from 'lucide-react';
import { PageHeaderBanner } from '../../../components/common';
import { formatDateToYYYYMMDD } from '@/utils/dateUtils';

export interface ScheduleHeaderProps {
  busy?: boolean;
  currentMonday: Date;
  weekNumber: number;
  startLabel: string;
  endLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoCurrentWeek: () => void;
  onDateSelect: (dateString: string) => void;
  onCopyPreviousWeek: () => void;
  onOpenBulkModal: () => void;
  onExportExcel?: (format: ReportFormat) => void;
  canExport?: boolean;
}

export const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({
  busy=false,
  currentMonday,
  weekNumber,
  startLabel,
  endLabel,
  onPrevWeek,
  onNextWeek,
  onGoCurrentWeek,
  onDateSelect,
  onCopyPreviousWeek,
  onOpenBulkModal,
  onExportExcel,
  canExport = true,
}) => {
  return (
    <PageHeaderBanner
      className="[&>div:first-child]:items-center lg:[&>div:first-child]:grid lg:[&>div:first-child]:grid-cols-[minmax(0,1fr)_auto]"
      icon={
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
          <CalendarDays className="w-5 h-5" />
        </div>
      }
      title="Phân ca làm việc"
      titleExtra={
        <div className="flex basis-full items-center gap-2 flex-wrap">
          {/* Week Selector */}
          <div className="h-10 flex items-center gap-1.5 bg-white/80 dark:bg-[#0f1224] border border-blue-200/80 dark:border-[#272d5a] px-3 rounded-xl shadow-inner backdrop-blur-sm">
            <button
              type="button"
              onClick={onPrevWeek}
              title="Tuần trước"
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              className="relative flex items-center gap-1.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold px-2 cursor-pointer group"
              title="Bấm để chọn tuần theo lịch dương"
            >
              <CalendarRange className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              <span>
                TUẦN {weekNumber} ({startLabel} - {endLabel})
              </span>
              <input
                type="date"
                value={formatDateToYYYYMMDD(currentMonday)}
                onChange={(e) => onDateSelect(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full min-h-0"
              />
            </div>

            <button
              type="button"
              onClick={onNextWeek}
              title="Tuần sau"
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcut Today Button */}
          <button
            type="button"
            onClick={onGoCurrentWeek}
            className="h-10 px-3 rounded-xl bg-white/80 dark:bg-[#0f1224] hover:bg-slate-100 dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-blue-200/80 dark:border-[#272d5a] transition-colors shadow-inner backdrop-blur-sm cursor-pointer"
            title="Nhảy nhanh về tuần hiện tại"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Tuần này</span>
          </button>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <fieldset disabled={busy} className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Copy from previous week */}
            <button
              type="button"
              onClick={onCopyPreviousWeek}
              className="h-10 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#272d5a] transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              title="Sao chép toàn bộ ca từ tuần trước sang tuần này"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Sao chép tuần trước</span>
            </button>

            {/* Bulk Assign Button */}
            <button
              type="button"
              onClick={onOpenBulkModal}
              className="h-10 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Phân ca nhanh hàng loạt</span>
            </button>
          </fieldset>

          {onExportExcel && (
              <ReportExportButton onExport={onExportExcel} disabled={!canExport} />
          )}
        </div>
      }
    />
  );
};
