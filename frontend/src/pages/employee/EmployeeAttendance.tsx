import { AttendanceEventBadge } from '../../components/common/AttendanceEventBadge';
import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatVNTime, formatVNDate, getTodayVNString } from '../../utils/dateUtils';
import { Employee } from '../../types';
import {
  Clock,
  Calendar,
  ScanFace,
  Fingerprint,
  ShieldCheck,
  ListFilter,
  CheckCircle2
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
import { EmployeeAttendanceTab } from '@/features/employees';
import { useEmployeeAttendanceDetail } from '@/features/attendances';

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
  const { currentUser, attendance, employees } = useApp();
  const [urlParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'summary' | 'raw'>('summary');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Dates & Presets for Summary view
  const todayVN = getTodayVNString();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const startOfCurrentMonth = `${currentYear}-${currentMonth}-01`;

  const [startDate, setStartDate] = useState<string>(() => urlParams.get('date') || startOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(() => urlParams.get('date') || todayVN);
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState<string>('ALL');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('ALL');
  const [quickPreset, setQuickPreset] = useState<'today' | 'month' | 'all' | 'custom'>('month');

  const setQuickRange = (preset: 'today' | 'month' | 'all') => {
    setQuickPreset(preset);
    if (preset === 'today') {
      const d = getTodayVNString();
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'month') {
      setStartDate(startOfCurrentMonth);
      setEndDate(getTodayVNString());
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Resolve current employee profile
  const currentEmp = useMemo<Employee | undefined>(() => {
    if (!currentUser) return undefined;
    return employees.find(e => e.employee_id === currentUser.employee_id) || (currentUser as unknown as Employee);
  }, [currentUser, employees]);

  // Hook for attendance statistics & filtered logs
  const { employeeAttendanceLogs, attendanceStats } = useEmployeeAttendanceDetail({
    currentEmp: currentEmp || null,
    startDate,
    endDate,
    attendanceTypeFilter,
    attendanceStatusFilter,
  });

  // Employee's raw records only
  const empCode = currentUser?.employee_id;
  const myRecords = empCode
    ? attendance.filter(a => a.employee_id === empCode)
    : [];

  const filteredRawRecords = myRecords.filter(r => {
    if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Bento Top Banner */}
      <PageHeaderBanner
        title="Lịch sử Chấm công & Điểm danh"
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono font-medium border border-blue-200 dark:border-blue-700/50">
            {activeView === 'summary' ? 'BẢNG CÔNG & CA LÀM VIỆC' : 'LOGS SINH TRẮC'}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#0f1224] border border-blue-200/80 dark:border-[#272d5a] text-blue-600 dark:text-blue-400 text-xs font-mono shadow-xs backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>CHẾ ĐỘ XEM CÁ NHÂN</span>
          </div>
        }
      />

      {/* View Switcher Tabs */}
      <p className="text-sm text-slate-600 dark:text-slate-300">Quên quét không được tự tính công cho thời gian thiếu. Nếu được quản lý chấp thuận bù tiền, khoản bù được ghi vào phụ cấp cuối tháng.</p>
      <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 dark:bg-[#13162b] border border-slate-200 dark:border-[#21264b] rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveView('summary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer ${
            activeView === 'summary'
              ? 'bg-white dark:bg-[#1f2444] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/80 dark:border-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Tổng Hợp Công Theo Ca</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('raw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer ${
            activeView === 'raw'
              ? 'bg-white dark:bg-[#1f2444] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/80 dark:border-blue-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Nhật Ký Sinh Trắc Chi Tiết</span>
        </button>
      </div>

      {activeView === 'summary' ? (
        <EmployeeAttendanceTab
          currentEmp={currentEmp}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          quickPreset={quickPreset}
          setQuickRange={setQuickRange}
          setQuickPreset={setQuickPreset}
          attendanceTypeFilter={attendanceTypeFilter}
          setAttendanceTypeFilter={setAttendanceTypeFilter}
          attendanceStatusFilter={attendanceStatusFilter}
          setAttendanceStatusFilter={setAttendanceStatusFilter}
          attendanceStats={attendanceStats}
          employeeAttendanceLogs={employeeAttendanceLogs}
        />
      ) : (
        <div className="space-y-6">
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
              Hiển thị: <strong className="text-slate-900 dark:text-white">{filteredRawRecords.length}</strong> bản ghi
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
              {filteredRawRecords.length === 0 ? (
                <TableEmpty colSpan={7} message="Không tìm thấy bản ghi chấm công nào phù hợp." />
              ) : (
                filteredRawRecords.map(record => {
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
                        <AttendanceEventBadge type={record.type}/>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 min-w-0" title={record.method === 'FACE' ? 'Face ID' : record.method === 'FINGERPRINT' ? 'Vân tay' : 'Thủ công'}>
                          {record.method === 'FACE' ? (
                            <>
                              <ScanFace className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
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
      )}
    </div>
  );
};
