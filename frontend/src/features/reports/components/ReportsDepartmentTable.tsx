import React from 'react';
import { Building2 } from 'lucide-react';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
} from '../../../components/common';

export interface DepartmentSummaryRow {
  departmentName: string;
  color?: string;
  employeeCount: number;
  totalPunches: number;
  totalOvertimeHours: number;
  totalLateEarlyHours: number;
  unexcusedAbsenceCount: number;
  onTimeRate: number;
  totalSalary: number;
}

interface ReportsDepartmentTableProps {
  departmentsData: DepartmentSummaryRow[];
  selectedPeriod: string;
}

export const ReportsDepartmentTable: React.FC<ReportsDepartmentTableProps> = ({
  departmentsData,
  selectedPeriod: _selectedPeriod,
}) => {
  // Total summary for footer
  const totalEmployees = departmentsData.reduce((acc, d) => acc + d.employeeCount, 0);
  const totalPunches = departmentsData.reduce((acc, d) => acc + d.totalPunches, 0);
  const totalOvertime = departmentsData.reduce((acc, d) => acc + d.totalOvertimeHours, 0);
  const totalLateEarly = departmentsData.reduce((acc, d) => acc + d.totalLateEarlyHours, 0);
  const totalAbsences = departmentsData.reduce((acc, d) => acc + d.unexcusedAbsenceCount, 0);
  const totalSalary = departmentsData.reduce((acc, d) => acc + d.totalSalary, 0);
  const overallOnTimeRate = departmentsData.length > 0
    ? Number((departmentsData.reduce((acc, d) => acc + d.onTimeRate * d.totalPunches, 0) / (totalPunches || 1)).toFixed(1))
    : 100;

  // Helper for onTimeRate badge styling (>=90% green, >=80% yellow, <80% red)
  const getRateBadgeClass = (rate: number) => {
    if (rate >= 90) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
    if (rate >= 80) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs transition-colors">
      {/* Header: Đã xóa phụ đề và badge góc phải theo yêu cầu */}
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-[#1d2243]">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          Tổng hợp theo phòng ban
        </h3>
      </div>

      {/* Bảng phòng ban: Chỉ hiện tối đa 5 phòng ban, còn lại cuộn dọc */}
      <TableContainer minWidth="1000px" maxHeight="345px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell align="center" width="180px">Phòng ban</TableHeadCell>
            <TableHeadCell align="center" width="95px">Nhân viên</TableHeadCell>
            <TableHeadCell align="center" width="135px">Số lần chấm công</TableHeadCell>
            <TableHeadCell align="center" width="115px">Tăng ca</TableHeadCell>
            <TableHeadCell align="center" width="125px">Đi muộn/Về sớm</TableHeadCell>
            <TableHeadCell align="center" width="100px">Nghỉ làm</TableHeadCell>
            <TableHeadCell align="center" width="120px">Tỉ lệ đúng giờ</TableHeadCell>
            <TableHeadCell align="center" width="145px" isLast>Quỹ lương</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {departmentsData.length === 0 ? (
            <TableEmpty colSpan={8} message="Chưa có dữ liệu phòng ban cho tháng này." />
          ) : (
            departmentsData.map((dept, index) => (
              <TableRow key={dept.departmentName || index}>
                <TableCell align="left">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dept.color || '#3b82f6' }}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">{dept.departmentName}</span>
                  </div>
                </TableCell>

                <TableCell align="center" className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {dept.employeeCount}
                </TableCell>

                <TableCell align="center" className="font-mono text-slate-700 dark:text-slate-300">
                  {dept.totalPunches.toLocaleString('vi-VN')}
                </TableCell>

                {/* Tăng ca: màu xanh lá, đơn vị giờ */}
                <TableCell align="center" className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {dept.totalOvertimeHours > 0 ? `${dept.totalOvertimeHours.toFixed(1)} giờ` : '0 giờ'}
                </TableCell>

                {/* Đi muộn/Về sớm: đơn vị giờ */}
                <TableCell align="center" className="font-mono text-rose-600 dark:text-rose-400">
                  {dept.totalLateEarlyHours > 0 ? `${dept.totalLateEarlyHours.toFixed(1)} giờ` : '0 giờ'}
                </TableCell>

                {/* Nghỉ làm: text trực tiếp */}
                <TableCell align="center" className="font-mono font-medium text-rose-600 dark:text-rose-400">
                  {dept.unexcusedAbsenceCount > 0 ? `${dept.unexcusedAbsenceCount} ca` : <span className="text-slate-400">0 ca</span>}
                </TableCell>

                {/* Tỉ lệ đúng giờ */}
                <TableCell align="center">
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${getRateBadgeClass(dept.onTimeRate)}`}>
                    {dept.totalPunches > 0 ? `${dept.onTimeRate.toFixed(1)}%` : '—'}
                  </span>
                </TableCell>

                <TableCell align="right" isLast className="font-mono font-bold text-slate-900 dark:text-white">
                  {dept.totalSalary.toLocaleString('vi-VN')} ₫
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>

        {departmentsData.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-[#0c0f1f] font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-[#28305c] shadow-xs">
            <tr>
              <td className="py-3 px-4 uppercase text-[11px] tracking-wider text-left border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                Tổng cộng
              </td>
              <td className="py-3 px-4 text-center font-mono border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                {totalEmployees}
              </td>
              <td className="py-3 px-4 text-center font-mono border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                {totalPunches.toLocaleString('vi-VN')}
              </td>
              <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                {totalOvertime > 0 ? `${totalOvertime.toFixed(1)} giờ` : '0 giờ'}
              </td>
              <td className="py-3 px-4 text-center font-mono text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                {totalLateEarly > 0 ? `${totalLateEarly.toFixed(1)} giờ` : '0 giờ'}
              </td>
              <td className="py-3 px-4 text-center font-mono text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                {totalAbsences} ca
              </td>
              <td className="py-3 px-4 text-center border-r border-slate-200 dark:border-[#202752] bg-slate-50 dark:bg-[#0c0f1f]">
                <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${getRateBadgeClass(overallOnTimeRate)}`}>
                  {totalPunches > 0 ? `${overallOnTimeRate}%` : '—'}
                </span>
              </td>
              <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-[#0c0f1f]">
                {totalSalary.toLocaleString('vi-VN')} ₫
              </td>
            </tr>
          </tfoot>
        )}
      </TableContainer>
    </div>
  );
};
