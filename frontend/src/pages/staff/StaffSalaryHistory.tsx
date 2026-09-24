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

  const otRate = bonusPenalty?.overtime_rate || 100000;
  const penaltyRate = bonusPenalty?.late_early_penalty || 50000;

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Lịch sử Phiếu Lương Hàng Tháng
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-mono font-medium border border-green-500/20">
              ĐÃ XÁC THỰC CSDL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tra cứu và tải phiếu lương (Payslip) chi tiết của các kỳ đã hoàn tất thanh toán.
          </p>
        </div>

        <span className="text-xs font-mono text-blue-400 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
          MÃ NHÂN VIÊN: {empCode}
        </span>
      </div>

      {/* Bento Payroll Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
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
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {myPayrolls.map((p, idx) => {
                const hourly = Number(p.hourly_rate || 120000);
                const ot = Number(p.total_overtime ?? 0);
                const late = Number(p.total_late_early ?? 0);
                const allw = Number(p.allowance ?? 0);
                const net = Number(p.net_salary ?? 0);

                return (
                  <tr key={p.payroll_id || (p as any).id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {p.period || p.payroll_period}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {hourly.toLocaleString('vi-VN')} ₫/h
                    </td>
                    <td className="py-3.5 px-4 font-mono text-green-400">
                      +{ot}h ({((ot * otRate)).toLocaleString('vi-VN')} ₫)
                    </td>
                    <td className="py-3.5 px-4 font-mono text-red-400">
                      -{late}h ({((late * penaltyRate)).toLocaleString('vi-VN')} ₫)
                    </td>
                    <td className="py-3.5 px-4 font-mono text-green-500">
                      +{allw.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                      {net.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${p.status === 'FINALIZED'
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                      >
                        {p.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'CHỜ DUYỆT'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(p)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors shadow-md"
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
        {selectedSlip && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">
                  {currentUser?.full_name} ({empCode})
                </p>
                <p className="text-[11px] text-slate-400">
                  {currentUser?.department} • {currentUser?.position}
                </p>
              </div>
              <span className="text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20 font-medium">
                {selectedSlip.status === 'FINALIZED' ? 'ĐÃ THANH TOÁN' : 'TẠM TÍNH'}
              </span>
            </div>

            {/* Detailed table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Lương theo giờ (Hourly rate):</span>
                <span className="font-mono text-white font-semibold">
                  {Number(selectedSlip.hourly_rate || 120000).toLocaleString('vi-VN')} ₫/h
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Thưởng tăng ca ({selectedSlip.total_overtime ?? 0} giờ OT):</span>
                <span className="font-mono text-green-400 font-semibold">
                  + {((Number(selectedSlip.total_overtime ?? 0)) * otRate).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Phạt trễ/sớm ({selectedSlip.total_late_early ?? 0} giờ):</span>
                <span className="font-mono text-red-400 font-semibold">
                  - {((Number(selectedSlip.total_late_early ?? 0)) * penaltyRate).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Phụ cấp (Allowance):</span>
                <span className="font-mono text-green-500 font-semibold">
                  + {Number(selectedSlip.allowance ?? 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-3 border-t border-slate-800 text-sm">
                <span className="font-bold text-white">THỰC LĨNH (NET SALARY):</span>
                <span className="font-mono font-extrabold text-blue-400 text-base">
                  {Number(selectedSlip.net_salary ?? 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Tiền lương được chuyển khoản vào ngày 05 hàng tháng.</span>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="px-4 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};