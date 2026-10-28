import React from 'react';
import { Calendar, Sparkles, Lock, Unlock, Download } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common';

interface PayrollHeaderProps {
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  availablePeriods: string[];
  isCalculating: boolean;
  isFinalized: boolean;
  onCalculatePayroll: () => void;
  onOpenFinalizeModal: () => void;
  onOpenUnlockModal: () => void;
  onExportCSV: () => void;
}

export const PayrollHeader: React.FC<PayrollHeaderProps> = ({
  selectedPeriod,
  onSelectPeriod,
  availablePeriods,
  isCalculating,
  isFinalized,
  onCalculatePayroll,
  onOpenFinalizeModal,
  onOpenUnlockModal,
  onExportCSV,
}) => {
  const { role } = useAuth();
  return (
    <PageHeaderBanner
      title="Bảng lương & xét duyệt"
      titleExtra={
        <div className="flex items-center gap-2 bg-white/80 dark:bg-[#0f1224] px-3 py-1.5 rounded-xl border border-blue-200/80 dark:border-[#272d5a] shadow-inner backdrop-blur-sm">
          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kỳ lương:</span>
          <select
            aria-label="Kỳ lương"
            value={selectedPeriod}
            onChange={(e) => onSelectPeriod(e.target.value)}
            className="bg-transparent text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none cursor-pointer"
          >
            {availablePeriods.map((period) => {
              const [year, month] = period.split('-');
              return (
                <option key={period} value={period} className="bg-white dark:bg-[#13162b]">
                  Tháng {month}/{year}
                </option>
              );
            })}
          </select>
        </div>
      }
      actions={
        <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          {/* Row 1: Tự động tính lương & Chốt lương */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
            <button
              type="button"
              disabled={isCalculating || isFinalized}
              onClick={onCalculatePayroll}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
              title={
                isFinalized
                  ? 'Bảng lương đã chốt sổ, hãy mở khóa để tính toán lại'
                  : 'Tự động tính toán lại bảng lương từ dữ liệu chấm công mới nhất'
              }
            >
              <Sparkles className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : 'text-amber-300'}`} />
              <span>{isCalculating ? 'Đang tổng hợp...' : 'Tính lại lương'}</span>
            </button>

            {isFinalized ? (
              role === 'admin' ? (
                <button
                  type="button"
                  onClick={onOpenUnlockModal}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Mở khóa sửa bảng lương</span>
                </button>
              ) : (
                <div
                  title="Kỳ lương đã khóa sổ, chỉ Admin mới có quyền mở khóa để chỉnh sửa"
                  className="px-3.5 py-2 rounded-xl bg-slate-100/90 dark:bg-[#0f1224] text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-[#272d5a] shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đã khóa sổ (Chỉ Admin mở khóa)</span>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={onOpenFinalizeModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Chốt kỳ lương</span>
              </button>
            )}
          </div>

          {/* Row 2: Export CSV Button */}
          <div className="flex items-center justify-start lg:justify-end w-full">
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Xuất bảng lương chi tiết sang file CSV/Excel"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>
      }
    />
  );
};
