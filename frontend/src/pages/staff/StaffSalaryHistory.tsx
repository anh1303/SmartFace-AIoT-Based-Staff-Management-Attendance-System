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
  const { currentUser, payroll } = useApp();
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  // Staff's payroll records
  const myPayrolls = payroll.filter(
    p => p.employee_id === (currentUser?.employee_id || 'NV-001')
  );

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
              ĐÃ XÁC THỰC
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tra cứu và tải phiếu lương (Payslip) chi tiết của các kỳ đã hoàn tất thanh toán.
          </p>
        </div>

        <span className="text-xs font-mono text-blue-400 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
          TÀI KHOẢN: 1903.8888.XXXX (Techcombank)
        </span>
      </div>

      {/* Bento Payroll Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Kỳ tính lương</th>
                <th className="py-3.5 px-4 font-medium">Ngày công</th>
                <th className="py-3.5 px-4 font-medium">Lương cơ bản</th>
                <th className="py-3.5 px-4 font-medium">Phụ cấp & OT</th>
                <th className="py-3.5 px-4 font-medium">Khấu trừ</th>
                <th className="py-3.5 px-4 font-medium">Thực lĩnh (Net)</th>
                <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {myPayrolls.map(p => (
                <tr key={p.payroll_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    Tháng {p.period}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {p.working_days} ngày ({p.working_hours}h)
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {p.base_salary.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3.5 px-4 font-mono text-green-500">
                    +{p.allowance.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3.5 px-4 font-mono text-red-400">
                    -{p.deduction.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                    {p.total_paid.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                        p.status === 'FINALIZED'
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {p.status === 'FINALIZED' ? 'ĐÃ THANH TOÁN' : 'CHỜ DUYỆT'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal Detail */}
      <Modal
        isOpen={Boolean(selectedSlip)}
        onClose={() => setSelectedSlip(null)}
        title={`Phiếu Lương Chi Tiết - Tháng ${selectedSlip?.period}`}
        subtitle="Hệ thống tự động tính lương & khấu trừ thuế"
        maxWidth="lg"
      >
        {selectedSlip && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">
                  {currentUser?.full_name} ({currentUser?.employee_id})
                </p>
                <p className="text-[11px] text-slate-400">
                  {currentUser?.department} • {currentUser?.position}
                </p>
              </div>
              <span className="text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20 font-medium">
                {selectedSlip.status}
              </span>
            </div>

            {/* Detailed table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Lương cơ bản hợp đồng:</span>
                <span className="font-mono text-white font-semibold">
                  {selectedSlip.base_salary.toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Số ngày công thực tế:</span>
                <span className="font-mono text-white">
                  {selectedSlip.working_days} ngày ({selectedSlip.working_hours} giờ)
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Phụ cấp & Thưởng OT:</span>
                <span className="font-mono text-green-500 font-semibold">
                  +{selectedSlip.allowance.toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Khấu trừ bảo hiểm & phạt:</span>
                <span className="font-mono text-red-400 font-semibold">
                  -{selectedSlip.deduction.toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between py-3 border-t border-slate-800 text-sm">
                <span className="font-bold text-white">THỰC LĨNH CHUYỂN KHOẢN (NET):</span>
                <span className="font-mono font-extrabold text-white text-base">
                  {selectedSlip.total_paid.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Tiền lương đã được chuyển qua STK ngân hàng của nhân viên.</span>
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
