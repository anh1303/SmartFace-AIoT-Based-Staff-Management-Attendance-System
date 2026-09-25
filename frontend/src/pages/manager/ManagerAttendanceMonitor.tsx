import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayVNString } from '../../utils/dateUtils';
import { useDevices } from '../../features/attendance-monitor/hooks/useDevices';
import { useAttendanceSummaries } from '../../features/attendance-monitor/hooks/useAttendanceSummaries';
import { useAttendanceLocks } from '../../features/attendance-monitor/hooks/useAttendanceLocks';
import { useAttendancePairs, AttendancePairItem } from '../../features/attendance-monitor/hooks/useAttendancePairs';
import { AttendanceFilters } from '../../features/attendance-monitor/components/AttendanceFilters';
import { DeviceStatusCards } from '../../features/attendance-monitor/components/DeviceStatusCards';
import { AttendanceTable } from '../../features/attendance-monitor/components/AttendanceTable';
import { AttendanceEditModal } from '../../features/attendance-monitor/components/AttendanceEditModal';
import { exportAttendanceToCSV } from '../../features/attendance-monitor/csvExport';

export const ManagerAttendanceMonitor: React.FC = () => {
  const { attendance, employees, workShifts, showToast } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayVNString());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { devices } = useDevices();
  const { isDateLocked, toggleLock } = useAttendanceLocks();
  const { customOvertimeMap, customLateEarlyMap, adjustAttendance } = useAttendanceSummaries(selectedDate);

  const isCurrentDateLocked = isDateLocked(selectedDate);

  const employeePairs = useAttendancePairs(
    employees,
    workShifts,
    attendance,
    selectedDate,
    searchTerm,
    statusFilter,
    customOvertimeMap,
    customLateEarlyMap
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
    if (!item.hasCheckedIn && !item.hasCheckedOut) {
      showToast('Không thể chỉnh sửa khi nhân viên chưa có bản ghi chấm công', 'warning');
      return;
    }

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
    if (!selectedDate) return;
    toggleLock(selectedDate, !isCurrentDateLocked);
  };

  const handleExportCSV = () => {
    if (!isCurrentDateLocked) {
      showToast('Nút chỉ bật sau khi đã chốt ca ngày đang chọn', 'warning');
      return;
    }
    exportAttendanceToCSV(employeePairs, selectedDate, showToast);
  };

  const handleSaveAdjustments = async (payload: {
    employeeId: string;
    date: string;
    late_early: number;
    overtime: number;
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
      <AttendanceFilters
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isCurrentDateLocked={isCurrentDateLocked}
        onToggleLock={handleToggleLock}
        onExportCSV={handleExportCSV}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      <DeviceStatusCards devices={devices} />

      <AttendanceTable
        employeePairs={employeePairs}
        selectedDate={selectedDate}
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