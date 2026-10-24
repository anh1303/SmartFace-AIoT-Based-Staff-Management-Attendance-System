import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatVNTime, formatVNDate } from '../../utils/dateUtils';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  Fingerprint,
  ShieldCheck,
  Lock
} from 'lucide-react';
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
  CodeBadge,
  FilterSelect
} from '../../components/common';

const METHOD_OPTIONS = [
  { value: 'ALL', label: 'Tất cả phương thức' },
  { value: 'FACE', label: 'Khuôn mặt (Face ID)' },
  { value: 'FINGERPRINT', label: 'Vân tay (Fingerprint)' },
  { value: 'MANUAL', label: 'Thủ công (Manual)' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Vào ca & Tan ca' },
  { value: 'CHECK_IN', label: 'Vào ca (Check-in)' },
  { value: 'CHECK_OUT', label: 'Tan ca (Check-out)' },
];

export const EmployeeAttendance: React.FC = () => {
  const { currentUser, attendance } = useApp();
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Employee's records only
  const empCode = currentUser?.employee_id;
  const myRecords = empCode
    ? attendance.filter(a => a.employee_id === empCode)
    : [];

  const filteredRecords = myRecords.filter(r => {
    if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Bento Top Banner with Continuous Shifting Gradient & Floating Blobs */}
      <PageHeaderBanner
        title="Lịch sử Chấm công & Điểm danh"
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-mono font-medium border border-purple-200 dark:border-purple-700/50">
            LOGS SINH TRẮC
          </span>
        }
        actions={
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#0f1224] border border-purple-200/80 dark:border-[#272d5a] text-purple-600 dark:text-purple-400 text-xs font-mono shadow-xs backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>CHỈ ĐỌC • DỮ LIỆU BẤT BIẾN</span>
          </div>
        }
      />

      {/* Bento Filter Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Phương thức"
            value={methodFilter}
            options={METHOD_OPTIONS}
            onChange={setMethodFilter}
          />
          <FilterSelect
            label="Loại"
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={setTypeFilter}
          />
        </div>

        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          Hiển thị: <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> bản ghi
        </span>
      </div>

      {/* Standard Design System Table */}
      <TableContainer minWidth="850px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell width="130px">Mã bản ghi</TableHeadCell>
            <TableHeadCell width="140px">Thời gian</TableHeadCell>
            <TableHeadCell width="120px">Loại sự kiện</TableHeadCell>
            <TableHeadCell width="140px">Phương thức</TableHeadCell>
            <TableHeadCell width="160px">Thiết bị điểm danh</TableHeadCell>
            <TableHeadCell width="120px">Độ tin cậy</TableHeadCell>
            <TableHeadCell width="110px" isLast>Trạng thái</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {filteredRecords.length === 0 ? (
            <TableEmpty colSpan={7} message="Không tìm thấy bản ghi chấm công nào phù hợp." />
          ) : (
            filteredRecords.map(record => {
              const timeFormatted = formatVNTime(record.timestamp);
              const dateFormatted = formatVNDate(record.timestamp);
              const punctuality = record.punctuality || (record.status === 'VALID' ? 'ON_TIME' : record.status);

              return (
                <TableRow key={record.attendance_id}>
                  <TableCell>
                    <CodeBadge code={record.attendance_id} />
                  </TableCell>
                  <TableCell className="truncate" title={`${timeFormatted} ${dateFormatted}`}>
                    <div className="font-semibold text-slate-900 dark:text-white font-mono truncate">{timeFormatted}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{dateFormatted}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase font-mono ${record.type === 'CHECK_IN'
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50'
                        }`}
                    >
                      {record.type === 'CHECK_IN' ? 'VÀO CA' : 'TAN CA'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0" title={record.method === 'FACE' ? 'Face ID' : record.method === 'FINGERPRINT' ? 'Vân tay' : 'Thủ công'}>
                      {record.method === 'FACE' ? (
                        <>
                          <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="truncate">Face ID</span>
                        </>
                      ) : record.method === 'FINGERPRINT' ? (
                        <>
                          <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">Vân tay</span>
                        </>
                      ) : (
                        <span className="truncate">Thủ công</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-slate-700 dark:text-slate-300 truncate" title={record.device_id}>
                    {record.device_id}
                  </TableCell>
                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {record.verification_score !== null && record.verification_score !== undefined
                      ? `${(record.verification_score * 100).toFixed(1)}% Match`
                      : '--'}
                  </TableCell>
                  <TableCell isLast>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${punctuality === 'ON_TIME'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : punctuality === 'LATE'
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                          : punctuality === 'EARLY_LEAVE'
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                        }`}
                    >
                      {punctuality === 'ON_TIME'
                        ? 'ĐÚNG GIỜ'
                        : punctuality === 'LATE'
                          ? 'ĐI MUỘN'
                          : punctuality === 'EARLY_LEAVE'
                            ? 'VỀ SỚM'
                            : 'VẮNG MẶT'}
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

