import React from 'react';
import { Download, Calendar, BarChart3 } from 'lucide-react';
import { PageHeaderBanner } from '../../../components/common';

interface ReportsHeaderProps {
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  availablePeriods: string[];
  onOpenExportModal: () => void;
}

export const ReportsHeader: React.FC<ReportsHeaderProps> = ({
  selectedPeriod,
  onSelectPeriod,
  availablePeriods,
  onOpenExportModal,
}) => {
  return (
    <PageHeaderBanner
      icon={
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
      }
      title="Báo cáo & Thống kê"
      titleExtra={
        <div className="flex items-center gap-2 bg-white/80 dark:bg-[#0f1224] px-3.5 py-1.5 rounded-xl border border-blue-200/80 dark:border-[#272d5a] shadow-inner backdrop-blur-sm">
          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tháng báo cáo:</span>
          <select
            aria-label="Tháng báo cáo"
            value={selectedPeriod}
            onChange={(e) => onSelectPeriod(e.target.value)}
            className="bg-transparent text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none cursor-pointer"
          >
            {availablePeriods.map((period) => {
              const [year, month] = period.split('-');
              return (
                <option key={period} value={period} className="bg-white dark:bg-[#13162b] text-slate-900 dark:text-white">
                  Tháng {month}/{year}
                </option>
              );
            })}
          </select>
        </div>
      }
      actions={
        <button
          type="button"
          onClick={onOpenExportModal}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo CSV</span>
        </button>
      }
    />
  );
};
