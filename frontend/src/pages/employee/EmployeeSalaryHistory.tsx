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
import {
  PageHeaderBanner,
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  ActionEditButton
} from '../../components/common';
import { PayrollRecord } from '../../types';

export const EmployeeSalaryHistory: React.FC = () => {
  const { currentUser, payroll, bonusPenalty } = useApp();
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  const empCode = currentUser?.employee_id || '';

  // Employee's payroll records sorted by period desc
  const myPayrolls = empCode
    ? payroll
        .filter(p => p.employee_id === empCode)
        .sort((a, b) => (b.period || '').localeCompare(a.period || ''))
    : [];

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
      <PageHeaderBanner
        title="Lịch sử Phiếu Lương Hàng Tháng"
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium border border-emerald-500/20">
            ĐÃ XÁC THỰC CSDL
          </span>
        }
        actions={
          <span className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-[#0f1224]/80 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-purple-200/80 dark:border-[#272d5a] shadow-xs">
            MÃ NHÂN VIÊN: {empCode}
          </span>
        }
      />

      {/* Standard Design System Table */}
      <TableContainer minWidth="950px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell width="130px">Kỳ lương</TableHeadCell>
            <TableHeadCell width="120px">Lương/giờ</TableHeadCell>
            <TableHeadCell width="160px">Tăng ca (OT)</TableHeadCell>
            <TableHeadCell width="160px">Trễ / Sớm</TableHeadCell>
            <TableHeadCell width="120px">Phụ cấp</TableHeadCell>
            <TableHeadCell width="140px">Thực lĩnh (Net)</TableHeadCell>
            <TableHeadCell width="110px">Trạng thái</TableHeadCell>
            <TableHeadCell width="110px" align="right" isLast>Thao tác</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {myPayrolls.length === 0 ? (
            <TableEmpty colSpan={8} message="Không có dữ liệu phiếu lương nào." />
          ) : (
            myPayrolls.map((p, idx) => {
              const hourly = Number(p.hourly_rate || 120000);
              const ot = Number(p.total_overtime ?? 0);
              const late = Number(p.total_late_early ?? 0);
              const allw = Number(p.allowance ?? 0);
              const net = Number(p.net_salary ?? 0);
              const otAmount = getOTAmount(ot, hourly);
              const lateAmount = getLateAmount(late, hourly);
              const periodStr = p.period || p.payroll_period;

              return (
                <TableRow key={p.payroll_id || idx}>
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white truncate" title={periodStr}>
                    {periodStr}
                  </TableCell>
                  <TableCell className="font-mono truncate" title={`${hourly.toLocaleString('vi-VN')} ₫/h`}>
                    {hourly.toLocaleString('vi-VN')} ₫/h
                  </TableCell>
                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 truncate" title={`+${ot}h (${otAmount.toLocaleString('vi-VN')} ₫)`}>
                    +{ot}h ({otAmount.toLocaleString('vi-VN')} ₫)
                  </TableCell>
                  <TableCell className="font-mono text-rose-600 dark:text-red-400 truncate" title={`-${late}h (${lateAmount.toLocaleString('vi-VN')} ₫)`}>
                    -{late}h ({lateAmount.toLocaleString('vi-VN')} ₫)
                  </TableCell>
                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 truncate" title={`+${allw.toLocaleString('vi-VN')} ₫`}>
                    +{allw.toLocaleString('vi-VN')} ₫
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm truncate" title={`${net.toLocaleString('vi-VN')} ₫`}>
                    {net.toLocaleString('vi-VN')} ₫
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${p.status === 'FINALIZED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                    >
                      {p.status === 'FINALIZED' ? 'ĐÃ CHỐT' : 'CHỜ DUYỆT'}
                    </span>
                  </TableCell>
                  <TableCell isLast align="right">
                    <ActionEditButton
                      onClick={() => setSelectedSlip(p)}
                      icon={Eye}
                      label="Xem phiếu"
                      title="Xem chi tiết phiếu lương"
                      className="ml-auto"
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TableContainer>

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

export const StaffSalaryHistory = EmployeeSalaryHistory;