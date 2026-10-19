import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayVNString } from '../../utils/dateUtils';
import { useDepartmentPositions } from '../../hooks';
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
} from '@/features/attendance';

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

  const { devices } = useDevices();
  const { isDateLocked, toggleLock } = useAttendanceLocks();
  const { customOvertimeMap, customLateEarlyMap, summariesByKey, adjustAttendance } = useAttendanceSummaries(startDate, endDate);

  const isCurrentDateLocked = isDateLocked(startDate) || (startDate !== endDate && isDateLocked(endDate));

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
    positionFilter, summariesByKey
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
  } | null>(null);

  const handleOpenEditModal = (item: AttendancePairItem) => {
    setEditingItem({
      employee: item.employee,
      shiftName: item.shift.name,
      shiftTimeRange: item.shift.timeRange,
      start_time: item.shift.start_time,
      end_time: item.shift.end_time,
      inTime: item.events[0].time,
      outTime: item.events[1].time,
      initialOTSec: item.initialOTSec,
      currentOTSec: item.currentOTSec,
      initialLateEarlySec: item.initialLateEarlySec,
      currentLateEarlySec: item.currentLateEarlySec,
      date: item.date,
    });
    setIsEditModalOpen(true);
  };

  const handleToggleLock = () => {
    if (!startDate) return;
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
    try {
      await adjustAttendance(payload);
      showToast('Đã lưu dữ liệu điều chỉnh chấm công vào CSDL thành công', 'success');
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6">
      <AttendanceHeader
        startDate={startDate}
        endDate={endDate}
        isCurrentDateLocked={isCurrentDateLocked}
        onToggleLock={handleToggleLock}
        onExportCSV={handleExportCSV}
      />

      <DeviceStatusCards devices={devices} />

      {/* AIoT Realtime Gate Camera & Live Events Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <WebRTCPlayer
            deviceId="PI4_FRONT_GATE"
            deviceName="Cổng Kiểm Soát — Raspberry Pi 4 Edge AI"
            showToast={showToast}
          />
        </div>
        <div className="lg:col-span-1 h-full min-h-[360px]">
          <LiveEventFeed
            events={liveEvents}
            onClear={clearEvents}
            isSocketConnected={isSocketConnected}
          />
        </div>
      </div>

      {/* Bộ lọc chấm công: Tách 2 thanh (Thanh 1: Khoảng ngày, Thanh 2: Tìm kiếm + Phòng ban + Chức vụ + Trạng thái) */}
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

      <AttendanceTable
        employeePairs={employeePairs}
        startDate={startDate}
        endDate={endDate}
        onOpenEditModal={handleOpenEditModal}
      />

      <AttendanceEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editingItem={editingItem}
        onSave={handleSaveAdjustments}
      />
    </div>
  );
};