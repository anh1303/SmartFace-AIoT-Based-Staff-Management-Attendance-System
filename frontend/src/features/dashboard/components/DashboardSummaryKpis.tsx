import React from 'react';
import { Users, LogIn, Briefcase, LogOut } from 'lucide-react';
import type { DashboardKpis } from '../api/dashboardApi';

interface DashboardSummaryKpisProps {
  kpis: DashboardKpis;
}

export const DashboardSummaryKpis: React.FC<DashboardSummaryKpisProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Nhân viên làm việc hôm nay */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-[#161938] dark:via-[#13162b] dark:to-[#1b1736] border border-slate-200/80 dark:border-[#262c5b] rounded-2xl p-5 flex flex-col justify-between hover:border-purple-400/50 dark:hover:border-purple-500/40 transition-all shadow-xs group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
            Nhân viên làm việc hôm nay
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            {kpis.workingEmployeesCount}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            / {kpis.totalEmployees} nhân viên
          </span>
        </div>
      </div>

      {/* 2. Đã check-in */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 dark:from-[#11242d] dark:via-[#13162b] dark:to-[#10232b] border border-slate-200/80 dark:border-[#1d4144] rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-400/50 dark:hover:border-emerald-500/40 transition-all shadow-xs group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <LogIn className="w-4 h-4" />
          </div>
          <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
            Đã check-in
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {kpis.checkInCount}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            lượt check-in
          </span>
        </div>
      </div>

      {/* 3. Đang làm việc */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30 dark:from-[#12203b] dark:via-[#13162b] dark:to-[#12243d] border border-slate-200/80 dark:border-[#1e345e] rounded-2xl p-5 flex flex-col justify-between hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all shadow-xs group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
            Đang làm việc
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {kpis.currentlyWorkingCount}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            người tại văn phòng
          </span>
        </div>
      </div>

      {/* 4. Đã check-out */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 dark:from-[#2a1d1d] dark:via-[#13162b] dark:to-[#241a18] border border-slate-200/80 dark:border-[#4d2f23] rounded-2xl p-5 flex flex-col justify-between hover:border-amber-400/50 dark:hover:border-amber-500/40 transition-all shadow-xs group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
            Đã check-out
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            {kpis.checkOutCount}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            lượt check-out
          </span>
        </div>
      </div>
    </div>
  );
};
