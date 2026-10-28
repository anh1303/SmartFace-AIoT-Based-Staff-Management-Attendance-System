import React from 'react';
import { Sparkles, AlertCircle, Lock, Unlock } from 'lucide-react';
import { BonusPenaltyPolicy, PayrollRecord } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface PayrollSummaryCardsProps {
  bonusPenalty: BonusPenaltyPolicy | null;
  isFinalized: boolean;
  allPeriodRecords: PayrollRecord[];
  totalExpense: number;
  onOpenPolicyModal: () => void;
}

export const PayrollSummaryCards: React.FC<PayrollSummaryCardsProps> = ({
  bonusPenalty,
  isFinalized,
  allPeriodRecords,
  totalExpense,
  onOpenPolicyModal,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* Card 1: Mức thưởng tăng ca */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-blue-300 dark:hover:border-blue-800/40 transition-colors flex flex-col justify-between group relative shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Mức thưởng tăng ca
          </span>
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <button
                type="button"
                onClick={onOpenPolicyModal}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
              >
                Thay đổi
              </button>
            ) : (
              <span
                title="Chỉ Quản trị viên (Admin) mới có quyền cấu hình hệ số này"
                className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-0.5"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Admin</span>
              </span>
            )}
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          </div>
        </div>
        <div className="pt-2 text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
          {bonusPenalty?.overtime_rate ? (
            Number(bonusPenalty.overtime_rate) <= 10 ? (
              <span>
                {bonusPenalty.overtime_rate}x{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  lương giờ
                </span>
              </span>
            ) : (
              <span>
                {Number(bonusPenalty.overtime_rate).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ₫/h
                </span>
              </span>
            )
          ) : (
            <span>
              1.5x{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                lương giờ
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Mức phạt đi trễ / về sớm */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-blue-300 dark:hover:border-blue-800/40 transition-colors flex flex-col justify-between group relative shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Mức phạt đi trễ / về sớm
          </span>
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <button
                type="button"
                onClick={onOpenPolicyModal}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
              >
                Thay đổi
              </button>
            ) : (
              <span
                title="Chỉ Quản trị viên (Admin) mới có quyền cấu hình hệ số này"
                className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-0.5"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Admin</span>
              </span>
            )}
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          </div>
        </div>
        <div className="pt-2 text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
          {bonusPenalty?.late_early_penalty ? (
            Number(bonusPenalty.late_early_penalty) <= 10 ? (
              <span>
                {bonusPenalty.late_early_penalty}x{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  lương giờ
                </span>
              </span>
            ) : (
              <span>
                {Number(bonusPenalty.late_early_penalty).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ₫/h
                </span>
              </span>
            )
          ) : (
            <span>
              50.000{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ₫/h
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Card 3: Trạng thái kỳ lương */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-blue-300 dark:hover:border-blue-800/40 transition-colors flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Trạng thái kỳ lương
          </span>
          {isFinalized ? (
            <Lock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Unlock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          )}
        </div>
        <div className="pt-1.5 pb-0.5 text-base sm:text-lg font-bold font-mono flex items-center gap-2 text-slate-900 dark:text-white">
          {isFinalized ? (
            <span className="text-emerald-600 dark:text-emerald-400">Đã niêm phong (Khóa)</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Đang soạn thảo (Mở)</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {allPeriodRecords.length} nhân sự • Tổng lương:{' '}
          <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
            {totalExpense.toLocaleString('vi-VN')} ₫
          </span>
        </p>
      </div>
    </div>
  );
};
