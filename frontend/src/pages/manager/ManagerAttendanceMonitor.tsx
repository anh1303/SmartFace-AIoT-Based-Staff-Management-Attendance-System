import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useShiftContext } from '../../context/ShiftContext';
import { useEmployeeContext } from '../../context/EmployeeContext';
import { getTodayVNString } from '../../utils/dateUtils';
import { useDepartmentPositions } from '@/features/employees';
import {
  AttendanceHeader,
  AttendanceFilters,
  DeviceStatusCards,
  AttendanceTable,
  AttendanceEditModal,
  WebRTCPlayer,
  LiveEventFeed,
  useDevices,
  useAttendanceSummaries,
  useAttendanceLocks,
  useAttendanceSocket,
  useAttendancePairs,
  AttendancePairItem,
  EditingItemState,
  exportAttendanceToCSV,
  useRawLogsPagination,
} from '@/features/attendances';
import { AttendanceRecord } from '../../types';
import { ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAttendanceApi } from '@/features/attendances/api/attendanceApi';

const useSafeSearchParams = () => {
  try {
    return useSearchParams();
  } catch {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    return [params, () => {}] as const;
  }
};

export const ManagerAttendanceMonitor: React.FC = () => {
  const shiftState = useShiftContext();
  const employeeState = useEmployeeContext();
  const { employees, workShifts, showToast, role, currentUser } = useApp();
  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  const [searchParams] = useSafeSearchParams();
  const paramDate = searchParams.get('date');
  const paramSearch = searchParams.get('search') || searchParams.get('employeeId');

  const { liveEvents, isSocketConnected, clearEvents } = useAttendanceSocket({ showToast });

  const [startDate, setStartDate] = useState<string>(() => paramDate || getTodayVNString());
  const [endDate, setEndDate] = useState<string>(() => paramDate || getTodayVNString());
  const [searchTerm, setSearchTerm] = useState(() => paramSearch || '');

  // Cập nhật bộ lọc khi URL search params thay đổi (khi điều hướng từ Lịch làm việc)
  useEffect(() => {
    const urlDate = searchParams.get('date');
    const urlSearch = searchParams.get('search') || searchParams.get('employeeId');
    if (urlDate) {
      setStartDate(urlDate);
      setEndDate(urlDate);
    }
    if (urlSearch !== null && urlSearch !== undefined) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const adjacentDate = (date: string, days: number) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const attendanceQuery = useQuery({
    queryKey: ['attendance', { startDate, endDate, fetchAllPages: true }],
    queryFn: () => fetchAttendanceApi({ startDate: adjacentDate(startDate, -1), endDate: adjacentDate(endDate, 1), fetchAllPages: true }),
    enabled: Boolean(currentUser) && Boolean(startDate && endDate) && startDate <= endDate,
  });
  const attendance = attendanceQuery.data || [];
  const [departmentFilter, setDepartmentFilter] = useState(() => {
    if (role === 'manager' && currentUser?.department) {
      return currentUser.department;
    }
    return 'ALL';
  });
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (isManager && managerDept) {
      setDepartmentFilter(managerDept);
    }
  }, [isManager, managerDept]);

  const { departmentOptions, positionOptions } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
    departmentFilter,
  });

  const { devices, isError: isDevicesError } = useDevices(role === 'admin');
  const { isDateLocked, toggleLockAsync, isLoading: locksLoading, isError: locksError, refetch: refetchLocks } = useAttendanceLocks();
  // useAttendanceSummaries lấy đúng khoảng ngày đang xem [startDate, endDate]
  const { customOvertimeMap, customLateEarlyMap, workingHoursMap, summaryMap, adjustAttendance, unlockEmployeeAttendance, refetch: refetchSummaries, isLoading: summariesLoading, isError: summariesError } = useAttendanceSummaries(startDate, endDate);

  const getDatesInRange = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const curr = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T00:00:00Z`);
    while (curr <= end) {
      dates.push(curr.toISOString().slice(0, 10));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  };

  const datesInRange = getDatesInRange(startDate, endDate);
  const isCurrentDateLocked = datesInRange.length > 0 && datesInRange.every(d => isDateLocked(d));
  const lockDataReady = !locksLoading && !locksError && (isCurrentDateLocked || (!shiftState.isLoading && !shiftState.isError));
  const today = getTodayVNString();
  const todayRequiresShift = datesInRange.includes(today) && !isCurrentDateLocked;
  const canLock = lockDataReady && (!todayRequiresShift || workShifts.some(shift => shift.date === today && shift.shift_type !== 'OFF'));
  const canExport = isCurrentDateLocked && !locksLoading && !locksError && !shiftState.isLoading && !shiftState.isError && !employeeState.isLoading && !employeeState.isError && !attendanceQuery.isLoading && !attendanceQuery.isError && !summariesLoading && !summariesError;

  // useAttendancePairs tiêu thụ giờ, cặp và cờ rà soát từ backend summary
  const employeePairs = useAttendancePairs(
    employees,
    workShifts,
    attendance,
    startDate,
    endDate,
    searchTerm,
    statusFilter,
    customOvertimeMap,
    customLateEarlyMap,
    departmentFilter,
    positionFilter,
    workingHoursMap,
    summaryMap
  );

  // Danh sách toàn hệ thống (không lọc) để tính chính xác cảnh báo chốt ca cho toàn bộ nhân sự
  const allEmployeePairs = useAttendancePairs(
    employees,
    workShifts,
    attendance,
    startDate,
    endDate,
    '',
    'ALL',
    customOvertimeMap,
    customLateEarlyMap,
    'ALL',
    'ALL',
    workingHoursMap,
    summaryMap
  );

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);

  const handleOpenEditModal = (item: AttendancePairItem) => {
    // Cho phép mở modal nếu nhân viên có ca làm việc (!isUnassigned), hoặc có chấm công, hoặc là ngày OFF, hoặc đã có OT
    const hasWorkShift = !item.isUnassigned;
    const hasScanData = item.hasCheckedIn || item.hasCheckedOut || item.rawEvents.length > 0;
    if (!hasWorkShift && !hasScanData && !item.isOffDay && item.currentOTSec === 0) {
      showToast('Không có dữ liệu ca hoặc chấm công để điều chỉnh', 'warning');
      return;
    }
    setEditingItem({
      employee: item.employee,
      shiftName: item.shift.name,
      shiftTimeRange: item.shift.timeRange,
      start_time: item.shift.start_time,
      end_time: item.shift.end_time,
      inTime: item.events[0]?.time || '--:--:--',
      outTime: item.events[1]?.time || '--:--:--',
      initialOTSec: item.initialOTSec,
      currentOTSec: item.currentOTSec,
      initialLateEarlySec: item.initialLateEarlySec,
      currentLateEarlySec: item.currentLateEarlySec,
      date: item.date,
      isOffDay: item.isOffDay || item.isUnassigned,
      rawWorkSeconds: item.rawWorkSeconds,
    });
    setIsEditModalOpen(true);
  };

  const handleToggleLock = async () => {
    if (role !== 'admin' || !startDate || !canLock) return;
    const targetLockState = !isCurrentDateLocked;
    const dates = getDatesInRange(startDate, endDate);

    if (targetLockState) {
      // Đang thực hiện CHỐT CA: Kiểm tra các ca lỗi/thiếu lượt sẽ bị quy đổi thành trễ/sớm toàn ca trên TOÀN HỆ THỐNG
      const affectedIncompleteItems = allEmployeePairs.filter(item => {
        if (item.isOffDay || item.isUnassigned) return false;
        const isMissingCheckout = item.hasCheckedIn && !item.hasCheckedOut;
        const isMissingCheckin = !item.hasCheckedIn && item.hasCheckedOut;
        const isReviewNeeded = item.needsReview && item.reviewReason?.split(',').some(r => ['MISSING_CHECK_OUT', 'NO_VALID_PAIR', 'INVALID_PAIR', 'FLAGGED_EVENT', 'UNPAIRED_CHECK_OUT', 'UNDER_MINIMUM_SHIFT', 'UNDER_HALF_SHIFT'].includes(r));
        return isMissingCheckout || isMissingCheckin || Boolean(isReviewNeeded);
      });

      if (affectedIncompleteItems.length > 0) {
        const sampleList = affectedIncompleteItems.slice(0, 5).map(item =>
          `• ${item.employee.full_name} (${item.employee.employee_id}) - Ngày ${item.date}: Ca ${item.shift.name} (${item.hasCheckedIn && !item.hasCheckedOut ? 'Thiếu check-out' : 'Thiếu/lỗi lượt quẹt'})`
        ).join('\n');
        const moreText = affectedIncompleteItems.length > 5 ? `\n... và ${affectedIncompleteItems.length - 5} ca khác.` : '';
        const confirmed = window.confirm(
          `CẢNH BÁO CHỐT CA TOÀN HỆ THỐNG:\nThao tác khóa ngày sẽ áp dụng cho TOÀN BỘ NHÂN VIÊN trong hệ thống (không phân biệt bộ lọc trên màn hình).\nPhát hiện ${affectedIncompleteItems.length} ca thiếu lượt / lỗi chấm công trên toàn hệ thống trong phạm vi ngày đã chọn sẽ được hệ thống chốt quy đổi phạt ĐI TRỄ / VỀ SỚM TOÀN BỘ CA (không tính công, không chuyển thành nghỉ không phép):\n\n${sampleList}${moreText}\n\nBạn có chắc chắn muốn tiếp tục chốt ca toàn hệ thống cho ${dates.length === 1 ? `ngày ${startDate}` : `${dates.length} ngày (từ ${startDate} đến ${endDate})`} không?`
        );
        if (!confirmed) return;
      } else {
        const confirmed = window.confirm(
          `Xác nhận chốt ca TOÀN HỆ THỐNG cho tất cả nhân viên trong ${dates.length === 1 ? `ngày ${startDate}` : `${dates.length} ngày (từ ${startDate} đến ${endDate})`}?`
        );
        if (!confirmed) return;
      }
    } else {
      // Đang thực hiện MỞ KHÓA
      const confirmed = window.confirm(
        `Xác nhận mở khóa chỉnh sửa ca làm việc TOÀN HỆ THỐNG cho ${dates.length === 1 ? `ngày ${startDate}` : `${dates.length} ngày (từ ${startDate} đến ${endDate})`}?`
      );
      if (!confirmed) return;
    }

    try {
      for (const d of dates) {
        await toggleLockAsync(d, targetLockState);
      }
      refetchSummaries();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái chốt ca', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!canExport) {
      showToast('Chỉ xuất sau khi đã chốt ca và dữ liệu sẵn sàng', 'warning');
      return;
    }
    const dateLabel = startDate === endDate ? startDate : `${startDate}_den_${endDate}`;
    exportAttendanceToCSV(employeePairs, dateLabel, showToast);
  };

  const handleSaveAdjustments = async (payload: {
    employeeId: string;
    date: string;
    late_early: number;
    overtime: number;
    reason: string;
  }) => {
    // Đợi API thành công rồi mới báo thành công; nếu lỗi sẽ ném ra để Modal giữ form
    await adjustAttendance(payload);
    showToast('Đã lưu dữ liệu điều chỉnh chấm công vào CSDL thành công', 'success');
  };

  const handleUnlockEmployee = async (item: AttendancePairItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn mở khóa ngày công ${item.date} của nhân viên ${item.employee.full_name} để xét duyệt lại?`)) {
      try {
        await unlockEmployeeAttendance({
          employeeId: item.employee.employee_id,
          date: item.date,
        });
        refetchSummaries();
      } catch (err: any) {
        showToast(err.message || 'Không thể mở khóa ngày công', 'error');
      }
    }
  };

  // PHÂN TRANG RAW LOGS: Xem lịch sử quẹt thẻ toàn hệ thống không bị giới hạn ở 5000 bản ghi
  const {
    showRawLogs,
    setShowRawLogs,
    rawLogPage,
    rawLogPageSize,
    rawLogsData,
    hasMoreRawLogs,
    isLoadingRawLogs,
    loadRawLogsPage,
  } = useRawLogsPagination({
    startDate,
    endDate,
    pageSize: 50,
    showToast,
  });

  return (
    <div className="space-y-6">
      <AttendanceHeader
        startDate={startDate}
        endDate={endDate}
        isCurrentDateLocked={isCurrentDateLocked}
        onToggleLock={handleToggleLock}
        onExportCSV={handleExportCSV}
        canLock={canLock}
        canExport={canExport}
      />

      {(locksError || shiftState.isError || employeeState.isError || attendanceQuery.isError || summariesError) && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span>Không thể tải {[
            locksError && 'trạng thái khóa ngày',
            shiftState.isError && 'lịch làm việc',
            employeeState.isError && 'danh sách nhân viên',
            attendanceQuery.isError && 'lượt quẹt',
            summariesError && 'tổng hợp công',
          ].filter(Boolean).join(', ')}. Vui lòng tải lại dữ liệu để xuất Excel đầy đủ.</span>
          <button type="button" className="underline font-semibold cursor-pointer" onClick={() => {
            if (locksError) refetchLocks();
            if (shiftState.isError) shiftState.refetchShifts();
            if (employeeState.isError) employeeState.refetchEmployees();
            if (attendanceQuery.isError) attendanceQuery.refetch();
            if (summariesError) refetchSummaries();
          }}>Thử tải lại</button>
        </div>
      )}

      {(attendanceQuery.isError || attendanceQuery.isLoading) && (
        <div role="alert" className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Lưu ý:</span>
            <span>{attendanceQuery.isError ? 'Không thể tải đầy đủ lượt quẹt cho khoảng ngày đã chọn.' : 'Đang tải lượt quẹt cho khoảng ngày đã chọn.'}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowRawLogs(true)}
            className="px-3 py-1 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
          >
            Mở nhật ký
          </button>
        </div>
      )}

      {role === 'admin' && <DeviceStatusCards devices={devices} isError={isDevicesError} />}

      {/* AIoT Realtime Gate Camera & Live Events Section */}
      <div className={role === 'admin' ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 items-start' : ''}>
        {role === 'admin' && <div className="lg:col-span-2">
          <WebRTCPlayer
            deviceId="PI4_FRONT_GATE"
            deviceName="Cổng Kiểm Soát — Raspberry Pi 4 Edge AI"
            showToast={showToast}
          />
        </div>}
        <div className="lg:col-span-1 h-full min-h-[360px]">
          <LiveEventFeed
            events={liveEvents}
            onClear={clearEvents}
            isSocketConnected={isSocketConnected}
          />
        </div>
      </div>

      {/* Bộ lọc chấm công */}
      <AttendanceFilters
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        departmentOptions={departmentOptions}
        positionFilter={positionFilter}
        setPositionFilter={setPositionFilter}
        positionOptions={positionOptions}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Bảng công tổng hợp chính */}
      <AttendanceTable
        employeePairs={employeePairs}
        startDate={startDate}
        endDate={endDate}
        onOpenEditModal={handleOpenEditModal}
        onUnlockEmployee={handleUnlockEmployee}
      />


      {/* Mục phân trang lịch sử Raw Logs (Khắc phục việc dừng âm thầm ở 5.000 bản ghi) */}
      {showRawLogs && (
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#21264b] pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Lịch Sử Quẹt Thẻ Toàn Hệ Thống (Raw Logs Phân Trang)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Khoảng ngày: <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{startDate} → {endDate}</span> • Đang xem trang {rawLogPage}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadRawLogsPage(rawLogPage)}
                disabled={isLoadingRawLogs}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0f1224] transition-colors cursor-pointer disabled:opacity-50"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingRawLogs ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={rawLogPage <= 1 || isLoadingRawLogs}
                  onClick={() => loadRawLogsPage(rawLogPage - 1)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trang trước</span>
                </button>
                <span className="px-3 py-1 text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                  {rawLogPage}
                </span>
                <button
                  type="button"
                  disabled={!hasMoreRawLogs || isLoadingRawLogs}
                  onClick={() => loadRawLogsPage(rawLogPage + 1)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#21264b]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0f1224] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-[#21264b]">
                <tr>
                  <th className="py-2.5 px-3">Thời gian ghi nhận</th>
                  <th className="py-2.5 px-3">Nhân viên</th>
                  <th className="py-2.5 px-3">Loại sự kiện</th>
                  <th className="py-2.5 px-3">Phương thức</th>
                  <th className="py-2.5 px-3">Thiết bị</th>
                  <th className="py-2.5 px-3">Điểm tin cậy</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243]">
                {rawLogsData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      {isLoadingRawLogs ? 'Đang nạp dữ liệu từ CSDL...' : 'Không có bản ghi nhật ký nào trong trang này'}
                    </td>
                  </tr>
                ) : (
                  rawLogsData.map((log, idx) => (
                    <tr key={log.attendance_id || idx} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1e3a]/30">
                      <td className="py-2.5 px-3 font-mono text-slate-900 dark:text-white font-medium">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {log.employee_name || log.employee_id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.type === 'CHECK_IN'
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {log.type === 'CHECK_IN' ? 'Vào ca (CHECK_IN)' : 'Hết ca (CHECK_OUT)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{log.method}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{log.device_id || '--'}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600">
                        {log.verification_score !== undefined && log.verification_score !== null
                          ? `${(log.verification_score * 100).toFixed(0)}%`
                          : '--'}
                      </td>
                      <td className="py-2.5 px-3">{log.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AttendanceEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editingItem={editingItem}
        onSave={handleSaveAdjustments}
      />
    </div>
  );
};
