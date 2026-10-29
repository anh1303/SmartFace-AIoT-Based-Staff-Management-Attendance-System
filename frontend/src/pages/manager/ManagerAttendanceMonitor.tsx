import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
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
  exportAttendanceToCSV,
} from '@/features/attendances';
import { fetchAttendancePaginatedApi } from '../../api/attendanceApi';
import { AttendanceRecord } from '../../types';
import { ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react';

export const ManagerAttendanceMonitor: React.FC = () => {
  const { attendance, employees, workShifts, showToast, role, currentUser } = useApp();
  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  const { liveEvents, isSocketConnected, clearEvents } = useAttendanceSocket({ showToast });

  const [startDate, setStartDate] = useState<string>(() => getTodayVNString());
  const [endDate, setEndDate] = useState<string>(() => getTodayVNString());
  const [searchTerm, setSearchTerm] = useState('');
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
  const { isDateLocked, toggleLock } = useAttendanceLocks();
  // useAttendanceSummaries lấy đúng khoảng ngày đang xem [startDate, endDate]
  const { customOvertimeMap, customLateEarlyMap, workingHoursMap, summaryMap, adjustAttendance } = useAttendanceSummaries(startDate, endDate);

  const isCurrentDateLocked = isDateLocked(startDate) || (startDate !== endDate && isDateLocked(endDate));

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

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    employee: AttendancePairItem['employee'];
    shiftName: string;
    shiftTimeRange: string;
    start_time: string;
    end_time: string;
    inTime: string;
    outTime: string;
    initialOTSec: number;
    currentOTSec: number;
    initialLateEarlySec: number;
    currentLateEarlySec: number;
    date: string;
    isOffDay?: boolean;
  } | null>(null);

  const handleOpenEditModal = (item: AttendancePairItem) => {
    // Cho phép mở modal nếu nhân viên có chấm công, hoặc là ngày OFF (quản lý xử lý OT ngày OFF), hoặc đã có OT
    if (!item.hasCheckedIn && !item.hasCheckedOut && !item.isOffDay && item.currentOTSec === 0) {
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
      isOffDay: item.isOffDay,
    });
    setIsEditModalOpen(true);
  };

  const handleToggleLock = () => {
    if (role !== 'admin' || !startDate) return;
    toggleLock(startDate, !isCurrentDateLocked);
    if (startDate !== endDate) {
      toggleLock(endDate, !isCurrentDateLocked);
    }
  };

  const handleExportCSV = () => {
    if (!isCurrentDateLocked) {
      showToast('Nút chỉ bật sau khi đã chốt ca ngày đang chọn', 'warning');
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

  // PHÂN TRANG RAW LOGS: Xem lịch sử quẹt thẻ toàn hệ thống không bị giới hạn ở 5000 bản ghi
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [rawLogPage, setRawLogPage] = useState(1);
  const [rawLogPageSize] = useState(50);
  const [rawLogsData, setRawLogsData] = useState<AttendanceRecord[]>([]);
  const [hasMoreRawLogs, setHasMoreRawLogs] = useState(false);
  const [isLoadingRawLogs, setIsLoadingRawLogs] = useState(false);

  const loadRawLogsPage = async (page: number) => {
    setIsLoadingRawLogs(true);
    try {
      const res = await fetchAttendancePaginatedApi({
        startDate,
        endDate,
        page,
        limit: rawLogPageSize,
      });
      setRawLogsData(res.data);
      setHasMoreRawLogs(res.hasMore);
      setRawLogPage(page);
    } catch {
      showToast('Không thể tải trang nhật ký quẹt thẻ', 'error');
    } finally {
      setIsLoadingRawLogs(false);
    }
  };

  useEffect(() => {
    if (showRawLogs) {
      loadRawLogsPage(1);
    }
  }, [showRawLogs, startDate, endDate]);

  return (
    <div className="space-y-6">
      <AttendanceHeader
        startDate={startDate}
        endDate={endDate}
        isCurrentDateLocked={isCurrentDateLocked}
        onToggleLock={handleToggleLock}
        onExportCSV={handleExportCSV}
      />

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
