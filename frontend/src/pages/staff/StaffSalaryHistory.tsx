import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  DollarSign,
  Eye,
  Building2,
  CreditCard
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PayrollRecord } from '../../types';

export const StaffSalaryHistory: React.FC = () => {
  const { currentUser, payroll, bonusPenalty } = useApp();
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  const empCode = currentUser?.employee_id || 'NV-001';

  // Staff's payroll records sorted by period desc
  const myPayrolls = payroll
    .filter(p => p.employee_id === empCode)
    .sort((a, b) => (b.period || '').localeCompare(a.period || ''));

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const penaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const getOTAmount = (otHours: number, hourly: number) => {
    return otRate <= 10 ? otHours * hourly * otRate : otHours * otRate;
  };

  const getLateAmount = (lateHours: number, hourly: number) => {
    return penaltyRate <= 10 ? lateHours * hourly * penaltyRate : lateHours * penaltyRate;
  };

  return (
    <div className="space-y-6">
      {/* Bento Header Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              Lịch sử Phiếu Lương Hàng Tháng
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium border border-emerald-500/20">
              ĐÃ XÁC THỰC CSDL
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tra cứu và tải phiếu lương (Payslip) chi tiết của các kỳ đã hoàn tất thanh toán.
          </p>
        </div>

        <span className="relative z-10 text-xs font-mono text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-[#0f1224]/80 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-purple-200/80 dark:border-[#272d5a] shadow-xs">
          MÃ NHÂN VIÊN: {empCode}
        </span>
      </div>

      {/* Bento Payroll Records Table */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-[#0f1224] border-b border-slate-200 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Kỳ lương</th>
                <th className="py-3.5 px-4 font-medium">Lương/giờ</th>
                <th className="py-3.5 px-4 font-medium">Tăng ca (OT)</th>
                <th className="py-3.5 px-4 font-medium">Trễ / Sớm</th>
                <th className="py-3.5 px-4 font-medium">Phụ cấp</th>
                <th className="py-3.5 px-4 font-medium">Thực lĩnh (Net)</th>
                <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
              {myPayrolls.map((p, idx) => {
                const hourly = Number(p.hourly_rate || 120000);
                const ot = Number(p.total_overtime ?? 0);
                const late = Number(p.total_late_early ?? 0);
                const allw = Number(p.allowance ?? 0);
                const net = Number(p.net_salary ?? 0);
                const otAmount = getOTAmount(ot, hourly);
                const lateAmount = getLateAmount(late, hourly);

                return (
                  <tr key={p.payroll_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {p.period || p.payroll_period}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {hourly.toLocaleString('vi-VN')} ₫/h
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400">
                      +{ot}h ({otAmount.toLocaleString('vi-VN')} ₫)
                    </td>
                    <td className="py-3.5 px-4 font-mono text-rose-600 dark:text-red-400">
                      -{late}h ({lateAmount.toLocaleString('vi-VN')} ₫)
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400">
                      +{allw.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {net.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${p.status === 'FINALIZED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                      >
                        {p.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'CHỜ DUYỆT'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(p)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem phiếu</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal Detail */}
      <Modal
        isOpen={Boolean(selectedSlip)}
        onClose={() => setSelectedSlip(null)}
        title={`Phiếu Lương Chi Tiết - Kỳ ${selectedSlip?.period || selectedSlip?.payroll_period}`}
        subtitle="Hệ thống tự động tính lương theo CSDL"
        maxWidth="lg"
      >
        {selectedSlip && (() => {
          const slipHourly = Number(selectedSlip.hourly_rate || 120000);
          const slipOT = Number(selectedSlip.total_overtime ?? 0);
          const slipLate = Number(selectedSlip.total_late_early ?? 0);
          const slipOTAmount = getOTAmount(slipOT, slipHourly);
          const slipLateAmount = getLateAmount(slipLate, slipHourly);

          return (
            <div className="space-y-4">
              {/* Header info */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {currentUser?.full_name} ({empCode})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentUser?.department} • {currentUser?.position}
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 font-medium">
                  {selectedSlip.status === 'FINALIZED' ? 'ĐÃ THANH TOÁN' : 'TẠM TÍNH'}
                </span>
              </div>

              {/* Detailed table */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Lương theo giờ (Hourly rate):</span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {slipHourly.toLocaleString('vi-VN')} ₫/h
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Thưởng tăng ca ({slipOT} giờ OT):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    + {slipOTAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Phạt trễ/sớm ({slipLate} giờ):</span>
                  <span className="font-mono text-rose-600 dark:text-red-400 font-semibold">
                    - {slipLateAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-[#21264b]">
                  <span className="text-slate-500 dark:text-slate-400">Phụ cấp (Allowance):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    + {Number(selectedSlip.allowance ?? 0).toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between py-3 border-t border-slate-200 dark:border-[#21264b] text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">THỰC LĨNH (NET SALARY):</span>
                  <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-base">
                    {Number(selectedSlip.net_salary ?? 0).toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Tiền lương được chuyển khoản vào ngày 05 hàng tháng.</span>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-200 dark:border-[#21264b]">
                <button
                  type="button"
                  onClick={() => setSelectedSlip(null)}
                  className="px-4 py-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};