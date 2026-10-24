import React from 'react';
import { History } from 'lucide-react';
import { PayrollRecord } from '../../../types';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty
} from '../../../components/common';

interface EmployeePayrollTabProps {
  hourlyRate?: number;
  pastPayrolls: PayrollRecord[];
  onSelectPayslip: (p: PayrollRecord) => void;
}

export const EmployeePayrollTab: React.FC<EmployeePayrollTabProps> = ({
  hourlyRate = 100000,
  pastPayrolls,
  onSelectPayslip,
}) => {
  return (
    <div className="space-y-6">
      {/* Past Months Payroll Records Table */}
      <div className="space-y-4">
        {/* Thanh riêng cho tiêu đề Lịch Sử Phiếu Lương */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 sm:px-5 sm:py-3.5 shadow-xs transition-colors flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Lịch Sử Phiếu Lương
          </h3>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {pastPayrolls.length} tháng
          </span>
        </div>

        <TableContainer minWidth="850px">
          <TableHead>
            <TableHeadRow>
              <TableHeadCell width="130px" align="center">Tháng</TableHeadCell>
              <TableHeadCell width="130px" align="center">Lương theo giờ</TableHeadCell>
              <TableHeadCell width="110px" align="center">Tổng giờ làm</TableHeadCell>
              <TableHeadCell width="110px" align="center">Số giờ tăng ca</TableHeadCell>
              <TableHeadCell width="140px" align="center">Số giờ đi trễ/về sớm</TableHeadCell>
              <TableHeadCell width="120px" align="center">Phụ cấp</TableHeadCell>
              <TableHeadCell width="130px" align="center" isLast>Thực lĩnh</TableHeadCell>
            </TableHeadRow>
          </TableHead>
          <TableBody>
            {pastPayrolls.length === 0 ? (
              <TableEmpty colSpan={7} message="Chưa có lịch sử bảng lương cho nhân viên này." />
            ) : (
              pastPayrolls.map((p, idx) => {
                const hourly = Number(p.hourly_rate ?? hourlyRate ?? 0);
                const working = Number(p.total_working_hours ?? p.working_hours ?? 0);
                const ot = Number(p.total_overtime ?? 0);
                const lateEarly = Number(p.total_late_early ?? 0);
                const allw = Number(p.allowance ?? 0);
                const net = Number(p.net_salary ?? 0);
                const periodStr = p.period || p.payroll_period;

                return (
                  <TableRow
                    key={p.payroll_id || idx}
                    onClick={() => onSelectPayslip(p)}
                    className="cursor-pointer"
                    title="Nhấp để xem chi tiết phiếu lương"
                  >
                    <TableCell className="font-mono font-bold text-slate-900 dark:text-white truncate" title={periodStr}>
                      {periodStr}
                    </TableCell>
                    <TableCell className="font-mono truncate" title={`${hourly.toLocaleString('vi-VN')} ₫/h`}>
                      {hourly.toLocaleString('vi-VN')} ₫/h
                    </TableCell>
                    <TableCell className="font-mono truncate" title={`${working}h`}>
                      {working}h
                    </TableCell>
                    <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 truncate" title={ot > 0 ? `+${ot}h` : '0h'}>
                      {ot > 0 ? `+${ot}h` : '0h'}
                    </TableCell>
                    <TableCell className="font-mono text-amber-600 dark:text-amber-400 truncate" title={lateEarly > 0 ? `${lateEarly}h` : '0h'}>
                      {lateEarly > 0 ? `${lateEarly}h` : '0h'}
                    </TableCell>
                    <TableCell className="font-mono text-purple-600 dark:text-purple-400 truncate" title={allw > 0 ? `+${allw.toLocaleString('vi-VN')} ₫` : '0 ₫'}>
                      {allw > 0 ? `+${allw.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </TableCell>
                    <TableCell isLast className="font-mono font-extrabold text-slate-900 dark:text-white text-sm truncate" title={`${net.toLocaleString('vi-VN')} ₫`}>
                      {net.toLocaleString('vi-VN')} ₫
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </TableContainer>
      </div>
    </div>
  );
};
