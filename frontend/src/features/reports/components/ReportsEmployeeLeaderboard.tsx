import React, { useState, useMemo } from 'react';
import { Award, Search } from 'lucide-react';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  FilterSelect,
} from '../../../components/common';

export interface EmployeeLeaderboardItem {
  rank: number;
  employeeId: string;
  fullName: string;
  avatar?: string | null;
  department: string;
  punchCount: number;
  overtimeHours: number;
  lateEarlyHours: number;
  absenceCount: number;
  onTimeRate: number;
  salary: number | null;
}

interface ReportsEmployeeLeaderboardProps {
  leaderboardData: EmployeeLeaderboardItem[];
  selectedPeriod: string;
}

export const ReportsEmployeeLeaderboard: React.FC<ReportsEmployeeLeaderboardProps> = ({
  leaderboardData,
  selectedPeriod: _selectedPeriod,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    leaderboardData.forEach((item) => {
      if (item.department) set.add(item.department);
    });
    return Array.from(set).sort();
  }, [leaderboardData]);

  // Filtered list
  const filteredList = useMemo(() => {
    return leaderboardData.filter((item) => {
      const matchSearch =
        item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = selectedDept === 'ALL' || item.department === selectedDept;
      return matchSearch && matchDept;
    });
  }, [leaderboardData, searchQuery, selectedDept]);

  // Helpers for on-time rate styling and performance evaluation (>=95% green, >=80% yellow, <80% red)
  const getRateBadgeClass = (rate: number) => {
    if (rate >= 95) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
    if (rate >= 80) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
  };

  const getPerformanceEvaluation = (rate: number) => {
    if (rate >= 95) {
      return {
        label: 'Xuất sắc',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      };
    }
    if (rate >= 80) {
      return {
        label: 'Tốt',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      };
    }
    return {
      label: 'Cần chú ý',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    };
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs transition-colors">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-[#1d2243]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Bảng xếp hạng chuyên cần nhân viên
          </h3>
        </div>

        {/* Filters: Search & Department Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã NV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
          </div>

          {/* Department Filter */}
          <FilterSelect
            label="Phòng ban:"
            value={selectedDept}
            onChange={setSelectedDept}
            allLabel="Tất cả phòng ban"
            options={departments.map((d) => ({ value: d, label: d }))}
          />
        </div>
      </div>

      {/* Table: hiển thị 5 nhân viên đầy đủ, cuộn xem tiếp */}
      <TableContainer minWidth="1020px" maxHeight="395px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell align="center" width="50px">#</TableHeadCell>
            <TableHeadCell align="center" width="200px">Nhân viên</TableHeadCell>
            <TableHeadCell align="center" width="120px">Phòng ban</TableHeadCell>
            <TableHeadCell align="center" width="110px">Số lần chấm công</TableHeadCell>
            <TableHeadCell align="center" width="95px">Tăng ca</TableHeadCell>
            <TableHeadCell align="center" width="110px">Đi muộn/Về sớm</TableHeadCell>
            <TableHeadCell align="center" width="85px">Nghỉ làm</TableHeadCell>
            <TableHeadCell align="center" width="110px">Tỉ lệ đúng giờ</TableHeadCell>
            <TableHeadCell align="right" width="130px">Quỹ lương</TableHeadCell>
            <TableHeadCell align="center" width="110px" isLast>Đánh giá</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {filteredList.length === 0 ? (
            <TableEmpty colSpan={10} message="Không tìm thấy nhân viên phù hợp." />
          ) : (
            filteredList.map((item) => {
              const initials = (item.fullName || item.employeeId)
                .split(' ')
                .map((w) => w[0])
                .slice(-2)
                .join('');

              const evalInfo = getPerformanceEvaluation(item.onTimeRate);

              return (
                <TableRow key={item.employeeId}>
                  {/* Rank # (vị trí 1 là màu vàng sáng) */}
                  <TableCell align="center">
                    {item.rank === 1 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-yellow-400/40 border border-yellow-200">
                        1
                      </span>
                    ) : item.rank === 2 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/40 font-black text-xs">
                        2
                      </span>
                    ) : item.rank === 3 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 font-black text-xs">
                        3
                      </span>
                    ) : (
                      <span className="font-mono font-semibold text-slate-400 text-xs">
                        {item.rank}
                      </span>
                    )}
                  </TableCell>

                  {/* Nhân viên: dữ liệu căn trái */}
                  <TableCell align="left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-[#1f254b] text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                        {item.avatar ? (
                          <img
                            src={item.avatar}
                            alt={item.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {item.employeeId}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Phòng ban: căn giữa cả tiêu đề và dữ liệu */}
                  <TableCell align="center" className="text-slate-700 dark:text-slate-300 font-medium">
                    {item.department || '--'}
                  </TableCell>

                  {/* Số lần chấm công */}
                  <TableCell align="center" className="font-mono text-slate-700 dark:text-slate-300">
                    {item.punchCount.toLocaleString('vi-VN')}
                  </TableCell>

                  {/* Tăng ca: 0 giờ nếu không có */}
                  <TableCell align="center" className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {item.overtimeHours > 0 ? `${item.overtimeHours.toFixed(1)} giờ` : '0 giờ'}
                  </TableCell>

                  {/* Đi muộn/Về sớm: 0 giờ nếu không có */}
                  <TableCell align="center" className="font-mono text-rose-600 dark:text-rose-400">
                    {item.lateEarlyHours > 0 ? `${item.lateEarlyHours.toFixed(1)} giờ` : '0 giờ'}
                  </TableCell>

                  {/* Nghỉ làm: 0 ca nếu không có */}
                  <TableCell align="center" className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    {item.absenceCount > 0 ? `${item.absenceCount} ca` : <span className="text-slate-400">0 ca</span>}
                  </TableCell>

                  {/* Tỉ lệ đúng giờ: >=95% xanh lá, >=80% vàng, <80% đỏ */}
                  <TableCell align="center">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${getRateBadgeClass(item.onTimeRate)}`}>
                      {item.punchCount > 0 ? `${item.onTimeRate.toFixed(1)}%` : '—'}
                    </span>
                  </TableCell>

                  {/* Quỹ lương: dữ liệu căn phải */}
                  <TableCell align="right" className="font-mono font-bold text-slate-900 dark:text-white">
                    {item.salary == null ? 'Chưa có phiếu' : `${item.salary.toLocaleString('vi-VN')} ₫`}
                  </TableCell>

                  {/* Cột Đánh giá theo tỉ lệ đúng giờ */}
                  <TableCell align="center" isLast>
                    <span className={`font-semibold text-[11px] px-2.5 py-1 rounded-full border ${evalInfo.badgeClass}`}>
                      {item.punchCount > 0 ? evalInfo.label : 'Chưa có dữ liệu'}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TableContainer>
    </div>
  );
};
