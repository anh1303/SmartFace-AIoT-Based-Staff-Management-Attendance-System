import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ScanFace,
  Fingerprint,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Download,
  Edit,
  X,
  FileSpreadsheet,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { Employee, WorkShift } from '../../types';
import { getTodayVNString, formatVNTime, formatVNDate } from '../../utils/dateUtils';

export const ManagerAttendanceMonitor: React.FC = () => {
  const { attendance, employees, workShifts, showToast } = useApp();

  // Default date set to today (YYYY-MM-DD in Vietnam timezone)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayVNString());

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Lock status state for dates
  const [lockedDates, setLockedDates] = useState<string[]>(['2026-09-10']);

  // Custom overtime map state: key `${employee_id}_${date}` -> OT seconds
  const [customOvertimeMap, setCustomOvertimeMap] = useState<Record<string, number>>({});
  // Custom late_early map state: key `${employee_id}_${date}` -> Late/Early seconds
  const [customLateEarlyMap, setCustomLateEarlyMap] = useState<Record<string, number>>({});

  // Fetch summaries from DB
  const fetchSummaries = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:3000/api/attendance/summaries', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const otMap: Record<string, number> = {};
          const leMap: Record<string, number> = {};
          json.data.forEach((s: any) => {
            const key = `${s.employee_id}_${s.date}`;
            otMap[key] = s.overtime;
            leMap[key] = s.late_early;
          });
          setCustomOvertimeMap(otMap);
          setCustomLateEarlyMap(leMap);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch attendance summaries from DB:', e);
    }
  };

  React.useEffect(() => {
    fetchSummaries();
  }, [selectedDate]);

  // Modal states for editing attendance (Late/Early & Overtime)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    employee: Employee;
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

  const [inputLEHours, setInputLEHours] = useState<number>(0);
  const [inputLEMinutes, setInputLEMinutes] = useState<number>(0);
  const [inputLESeconds, setInputLESeconds] = useState<number>(0);

  const [inputOTHours, setInputOTHours] = useState<number>(0);
  const [inputOTMinutes, setInputOTMinutes] = useState<number>(0);
  const [inputOTSeconds, setInputOTSeconds] = useState<number>(0);
  const [modalError, setModalError] = useState<string | null>(null);

  const formatShiftDate = (dStr?: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const handlePrevDay = () => {
    const [y, m, d] = (selectedDate || '2026-09-19').split('-').map(Number);
    const dateObj = new Date(y, m - 1, d - 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleNextDay = () => {
    const [y, m, d] = (selectedDate || '2026-09-19').split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Helper functions for time conversion
  const parseTimeToSeconds = (timeStr?: string): number | null => {
    if (!timeStr || timeStr === '--:--:--' || timeStr === '--') return null;
    if (timeStr.includes('T')) {
      const d = new Date(timeStr);
      return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }
    const parts = timeStr.split(':').map(Number);
    if (parts.length >= 2) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    return null;
  };

  const formatSecondsToHHMMSS = (totalSec: number): string => {
    if (totalSec <= 0) return '00:00:00';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const roundTo30Minutes = (totalSec: number): number => {
    if (totalSec <= 0) return 0;
    return Math.round(totalSec / 1800) * 1800;
  };

  // Tính Thời gian đi trễ/về sớm thực tế ban đầu (raw seconds)
  const calculateRawLateEarlySec = (
    shift: { start_time: string; end_time: string },
    inTimeStr?: string,
    outTimeStr?: string
  ): number => {
    const startSec = parseTimeToSeconds(shift.start_time);
    const endSec = parseTimeToSeconds(shift.end_time);
    const inSec = parseTimeToSeconds(inTimeStr);
    const outSec = parseTimeToSeconds(outTimeStr);

    let lateSec = 0;
    if (inSec !== null && startSec !== null && inSec > startSec) {
      lateSec = inSec - startSec;
    }

    let earlySec = 0;
    if (outSec !== null && endSec !== null && outSec < endSec) {
      earlySec = endSec - outSec;
    }

    const rawTotalSec = lateSec + earlySec;
    return rawTotalSec > 0 ? rawTotalSec : 0;
  };

  // Tính Tăng ca thực tế ban đầu (raw seconds): (checkout - checkin) - (hết ca - vào ca)
  const calculateRawInitialOTSec = (
    shift: { start_time: string; end_time: string },
    inTimeStr?: string,
    outTimeStr?: string
  ): number => {
    const startSec = parseTimeToSeconds(shift.start_time);
    const endSec = parseTimeToSeconds(shift.end_time);
    const inSec = parseTimeToSeconds(inTimeStr);
    const outSec = parseTimeToSeconds(outTimeStr);

    if (startSec === null || endSec === null || inSec === null || outSec === null) {
      return 0;
    }

    let actualWorkSec = outSec - inSec;
    if (actualWorkSec < 0) actualWorkSec += 86400; // Xử lý ca qua đêm

    let shiftWorkSec = endSec - startSec;
    if (shiftWorkSec < 0) shiftWorkSec += 86400;

    const rawOTSec = actualWorkSec - shiftWorkSec;
    return rawOTSec > 0 ? rawOTSec : 0;
  };

  const isCurrentDateLocked = selectedDate !== '' && lockedDates.includes(selectedDate);

  const handleToggleLockDate = () => {
    if (!selectedDate) {
      showToast('Vui lòng chọn 1 ngày cụ thể để chốt ca', 'warning');
      return;
    }
    if (lockedDates.includes(selectedDate)) {
      setLockedDates(prev => prev.filter(d => d !== selectedDate));
      showToast(`Đã mở khoá ca làm việc ngày ${selectedDate}`, 'info');
    } else {
      setLockedDates(prev => [...prev, selectedDate]);
      showToast(`Đã chốt ca làm việc ngày ${selectedDate} thành công!`, 'success');
    }
  };

  const handleExportCSV = () => {
    if (!selectedDate || !lockedDates.includes(selectedDate)) {
      showToast('Chỉ có thể xuất Excel/CSV khi đã chốt ca!', 'warning');
      return;
    }

    const headers = [
      'Mã NV', 'Họ tên', 'Phòng ban', 'Ca làm', 'Khung giờ ca',
      'Thời gian vào', 'Sự kiện vào', 'Phương thức vào', 'Thiết bị vào', 'Độ khớp vào', 'Trạng thái vào',
      'Thời gian ra', 'Sự kiện ra', 'Phương thức ra', 'Thiết bị ra', 'Độ khớp ra', 'Trạng thái ra',
      'Thời gian đi trễ/về sớm', 'Thời gian tăng ca'
    ];

    const rows = filteredEmployeePairs.map(item => {
      const { employee, shift, events, overtimeStr, lateEarlyStr } = item;
      const checkIn = events[0];
      const checkOut = events[1];
      return [
        employee.employee_id,
        `"${employee.full_name}"`,
        `"${employee.department}"`,
        `"${shift.name}"`,
        `"${shift.timeRange}"`,
        checkIn.time,
        checkIn.label,
        `"${checkIn.methodLabel}"`,
        checkIn.device_id,
        checkIn.score != null ? `${(checkIn.score * 100).toFixed(0)}%` : '--',
        checkIn.statusText,
        checkOut.time,
        checkOut.label,
        `"${checkOut.methodLabel}"`,
        checkOut.device_id,
        checkOut.score != null ? `${(checkOut.score * 100).toFixed(0)}%` : '--',
        checkOut.statusText,
        lateEarlyStr,
        overtimeStr
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCaoChamCong_${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Đã xuất báo cáo CSV thành công cho ngày ${selectedDate}!`, 'success');
  };

  // Query shifts directly from workShifts (employee_shifts table)
  const targetShifts = workShifts.filter(shift => {
    if (shift.shift_type === 'OFF') return false;
    if (selectedDate !== '' && shift.date !== selectedDate) return false;
    return true;
  });

  const employeePairs = targetShifts.map(empShift => {
    const emp = employees.find(e => e.employee_id === empShift.employee_id);
    if (!emp) return null;

    // Filter by search term
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const matches = (
        emp.full_name.toLowerCase().includes(term) ||
        emp.employee_id.toLowerCase().includes(term) ||
        emp.department.toLowerCase().includes(term)
      );
      if (!matches) return null;
    }

    const shiftDate = empShift.date;
    const shiftName = empShift.note || (empShift.shift_type === 'MORNING' ? 'Ca sáng' : empShift.shift_type === 'AFTERNOON' ? 'Ca chiều' : 'Hành chính');
    const shiftTimeRange = `${empShift.start_time} – ${empShift.end_time}`;

    // Get logs for employee on shiftDate
    const empLogs = attendance.filter(log => {
      if (log.employee_id !== emp.employee_id) return false;
      const vnDateParts = formatVNDate(log.timestamp).split('/'); // DD/MM/YYYY
      const logDateStr = vnDateParts.length === 3 ? `${vnDateParts[2]}-${vnDateParts[1]}-${vnDateParts[0]}` : '';
      return logDateStr === shiftDate;
    });

    const checkInLog = empLogs.find(l => l.type === 'CHECK_IN') || empLogs[0];
    const checkOutLog = empLogs.find(l => l.type === 'CHECK_OUT' || l.type === 'TAN_CA') || (empLogs.length > 1 ? empLogs[1] : undefined);

    const checkInTime = checkInLog ? formatVNTime(checkInLog.timestamp) : '--:--:--';
    const checkOutTime = checkOutLog ? formatVNTime(checkOutLog.timestamp) : '--:--:--';

    const hasCheckedIn = checkInLog !== undefined && checkInTime !== '--:--:--';
    const hasCheckedOut = checkOutLog !== undefined && checkOutTime !== '--:--:--';

    // Determine method: strictly Face-id or Vân tay with icons
    const isCheckInFace = checkInLog?.method === 'FACE' || (checkInLog?.device_id && checkInLog.device_id.toLowerCase().includes('face')) || true;
    const isCheckOutFace = checkOutLog?.method === 'FACE' || (checkOutLog?.device_id && checkOutLog.device_id.toLowerCase().includes('face'));

    // Calculate raw actual Late / Early time
    const initialLateEarlySec = calculateRawLateEarlySec(
      { start_time: empShift.start_time, end_time: empShift.end_time },
      checkInLog?.timestamp || (checkInLog ? checkInTime : undefined),
      checkOutLog?.timestamp || (checkOutLog ? checkOutTime : undefined)
    );

    // Calculate raw actual Initial OT
    const initialOTSec = hasCheckedOut ? calculateRawInitialOTSec(
      { start_time: empShift.start_time, end_time: empShift.end_time },
      checkInLog?.timestamp || (checkInLog ? checkInTime : undefined),
      checkOutLog?.timestamp || (checkOutLog ? checkOutTime : undefined)
    ) : 0;

    // Keys for custom adjustments in DB/state
    const summaryKey = `${emp.employee_id}_${shiftDate}`;

    // Current Late/Early (Rounded to 30 mins, displayed in RED)
    const currentLateEarlySec = customLateEarlyMap[summaryKey] !== undefined
      ? customLateEarlyMap[summaryKey]
      : roundTo30Minutes(initialLateEarlySec);
    const lateEarlyStr = formatSecondsToHHMMSS(currentLateEarlySec);

    // Current Overtime (Rounded to 30 mins)
    const currentOTSec = customOvertimeMap[summaryKey] !== undefined
      ? customOvertimeMap[summaryKey]
      : roundTo30Minutes(initialOTSec);
    const overtimeStr = hasCheckedOut ? formatSecondsToHHMMSS(currentOTSec) : '--:--:--';

    // Rows
    const checkInRow = {
      id: `${emp.employee_id}-${shiftDate}-in`,
      type: 'CHECK_IN' as const,
      label: 'Vào Ca',
      time: checkInTime,
      isFace: isCheckInFace,
      methodLabel: isCheckInFace ? 'Face-id' : 'Vân tay',
      device_id: checkInLog?.device_id || 'FaceCam-01',
      score: checkInLog?.verification_score ?? (checkInLog ? 0.99 : null),
      status: checkInLog ? checkInLog.status : 'UNRECORDED',
      statusText: checkInLog ? (checkInLog.status === 'LATE' ? 'Đi muộn' : 'Đúng giờ') : 'Chưa điểm danh',
    };

    const checkOutRow = {
      id: `${emp.employee_id}-${shiftDate}-out`,
      type: 'CHECK_OUT' as const,
      label: 'Hết ca',
      time: checkOutTime,
      isFace: isCheckOutFace,
      methodLabel: isCheckOutFace ? 'Face-id' : 'Vân tay',
      device_id: checkOutLog?.device_id || 'Fb-gate-02',
      score: checkOutLog?.verification_score ?? (checkOutLog ? 0.80 : null),
      status: checkOutLog ? checkOutLog.status : (checkInLog ? 'WORKING' : 'UNRECORDED'),
      statusText: checkOutLog ? (checkOutLog.status === 'EARLY_LEAVE' ? 'Về trễ' : 'Đúng giờ') : (checkInLog ? 'Đang làm' : 'Chưa điểm danh'),
    };

    return {
      employee: emp,
      shift: {
        name: shiftName,
        timeRange: shiftTimeRange,
        start_time: empShift.start_time,
        end_time: empShift.end_time,
        date: shiftDate,
      },
      events: [checkInRow, checkOutRow],
      hasCheckedIn,
      hasCheckedOut,
      initialLateEarlySec,
      currentLateEarlySec,
      lateEarlyStr,
      initialOTSec,
      currentOTSec,
      overtimeStr,
      date: shiftDate,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // Status Filter
  const filteredEmployeePairs = employeePairs.filter(item => {
    if (statusFilter === 'ALL') return true;
    return item.events.some(ev => ev.status === statusFilter || (statusFilter === 'ON_TIME' && ev.status === 'ON_TIME'));
  });

  const getStatusBadgeStyle = (statusText: string) => {
    switch (statusText) {
      case 'Đúng giờ':
      case 'Bình thường':
        return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'Đi muộn':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Về trễ':
      case 'Về sớm':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'Đang làm':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'Chưa điểm danh':
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700/60';
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: typeof employeePairs[0]) => {
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

    // Populate late/early inputs
    const leH = Math.floor(item.currentLateEarlySec / 3600);
    const leM = Math.floor((item.currentLateEarlySec % 3600) / 60);
    const leS = item.currentLateEarlySec % 60;
    setInputLEHours(leH);
    setInputLEMinutes(leM);
    setInputLESeconds(leS);

    // Populate OT inputs
    const otH = Math.floor(item.currentOTSec / 3600);
    const otM = Math.floor((item.currentOTSec % 3600) / 60);
    const otS = item.currentOTSec % 60;
    setInputOTHours(otH);
    setInputOTMinutes(otM);
    setInputOTSeconds(otS);

    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Validate changes
  const validateInputs = (
    leH: number, leM: number, leS: number,
    otH: number, otM: number, otS: number,
    item: typeof editingItem
  ) => {
    if (!item) return;
    const totalLESec = (leH || 0) * 3600 + (leM || 0) * 60 + (leS || 0);
    const totalOTSec = (otH || 0) * 3600 + (otM || 0) * 60 + (otS || 0);

    if (totalLESec > item.initialLateEarlySec) {
      setModalError(`Thời gian đi trễ/về sớm không được vượt quá thời gian trễ/sớm thực tế`);
      return;
    }

    if (totalOTSec > item.initialOTSec) {
      setModalError(`Thời gian tăng ca không được vượt quá thời gian tăng ca thực tế`);
      return;
    }

    setModalError(null);
  };

  const handleLEChange = (h: number, m: number, s: number) => {
    setInputLEHours(h);
    setInputLEMinutes(m);
    setInputLESeconds(s);
    validateInputs(h, m, s, inputOTHours, inputOTMinutes, inputOTSeconds, editingItem);
  };

  const handleOTChange = (h: number, m: number, s: number) => {
    setInputOTHours(h);
    setInputOTMinutes(m);
    setInputOTSeconds(s);
    validateInputs(inputLEHours, inputLEMinutes, inputLESeconds, h, m, s, editingItem);
  };

  // Save changes to DB and update state
  const handleSaveAttendanceAdjustments = async () => {
    if (!editingItem) return;
    const totalInputLESec = (inputLEHours || 0) * 3600 + (inputLEMinutes || 0) * 60 + (inputLESeconds || 0);
    const totalInputOTSec = (inputOTHours || 0) * 3600 + (inputOTMinutes || 0) * 60 + (inputOTSeconds || 0);

    if (totalInputLESec > editingItem.initialLateEarlySec) {
      setModalError(`Thời gian đi trễ/về sớm không được vượt quá thời gian trễ/sớm thực tế`);
      return;
    }

    if (totalInputOTSec > editingItem.initialOTSec) {
      setModalError(`Thời gian tăng ca không được vượt quá thời gian tăng ca thực tế`);
      return;
    }

    // Làm tròn 30 phút trước khi hiển thị lên web và lưu vào DB
    const roundedLE = roundTo30Minutes(totalInputLESec);
    const roundedOT = roundTo30Minutes(totalInputOTSec);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:3000/api/attendance/adjust', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employeeId: editingItem.employee.employee_id,
          date: editingItem.date,
          late_early: roundedLE,
          overtime: roundedOT,
        }),
      });

      const resData = await response.json().catch(() => null);

      if (response.ok && resData?.success) {
        const key = `${editingItem.employee.employee_id}_${editingItem.date}`;
        setCustomLateEarlyMap(prev => ({ ...prev, [key]: roundedLE }));
        setCustomOvertimeMap(prev => ({ ...prev, [key]: roundedOT }));

        showToast(
          `Đã lưu vào CSDL cho ${editingItem.employee.full_name}: Trễ/sớm: ${formatSecondsToHHMMSS(roundedLE)}, Tăng ca: ${formatSecondsToHHMMSS(roundedOT)}`,
          'success'
        );
        setIsEditModalOpen(false);
      } else {
        showToast(resData?.message || 'Lỗi khi lưu dữ liệu điều chỉnh vào CSDL!', 'error');
      }
    } catch (err) {
      console.error('Error saving adjustments to DB:', err);
      showToast('Không thể kết nối đến máy chủ để lưu thay đổi!', 'error');
    }
  };

  const devices = [
    { name: 'FaceCam-01', location: 'Cổng Chính Tòa A', status: 'ONLINE' },
    { name: 'CAM-04 (Turnstile)', location: 'Cổng Phụ Khu B', status: 'ONLINE' },
    { name: 'FaceCam-02', location: 'Cửa Lab Kỹ Thuật AI', status: 'ONLINE' },
    { name: 'FP-Gate-02', location: 'Máy Vân Tay Dự Phòng', status: 'ONLINE' },
  ];

  return (
    <div className="space-y-6">
      {/* Bento Header + Red Circled Action Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight flex items-center gap-2">
            Giám Sát Chấm Công Toàn Doanh Nghiệp
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dữ liệu điểm danh trực tiếp từ các thiết bị AI Edge Camera và cổng xoay an ninh.
          </p>
        </div>

        {/* Vùng khoanh đỏ: 2 nút Chốt ca & Xuất Excel/CSV */}
        <div className="flex items-center gap-3">
          {/* Nút 1: Chốt ca hôm nay / chốt ca theo ngày */}
          <button
            type="button"
            onClick={handleToggleLockDate}
            disabled={selectedDate === ''}
            title={selectedDate === '' ? 'Vui lòng chọn 1 ngày cụ thể để chốt ca' : ''}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${selectedDate === ''
              ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
              : isCurrentDateLocked
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 shadow-sm'
              }`}
          >
            {isCurrentDateLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã chốt ca ({selectedDate})</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Chốt ca {selectedDate === getTodayVNString() ? 'hôm nay' : selectedDate ? selectedDate : ''}</span>
              </>
            )}
          </button>

          {/* Nút 2: Xuất Excel/CSV (Chỉ bật khi đã chốt ca) */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!isCurrentDateLocked}
            title={!isCurrentDateLocked ? 'Nút chỉ bật sau khi đã chốt ca ngày đang chọn' : 'Xuất dữ liệu chấm công sang file CSV/Excel'}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${isCurrentDateLocked
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 cursor-pointer'
              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
              }`}
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Edge Devices Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map(dev => (
          <div key={dev.name} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ScanFace className="w-4 h-4 text-blue-400" />
                  {dev.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{dev.location}</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                {dev.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar & Date Selector (Vùng khoanh màu xanh - Mặc định ngày hôm nay) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo nhân viên, mã số, thiết bị..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Interactive Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1.5 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1 px-1.5 text-slate-400 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
            </div>

            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              title="Ngày trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs font-mono text-white px-2 py-1 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            />

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              title="Ngày sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedDate === ''
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                }`}
            >
              Tất cả ngày
            </button>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'ON_TIME', 'LATE', 'EARLY_LEAVE'].map(statusKey => {
            const label = statusKey === 'ALL' ? 'Tất cả' : statusKey === 'ON_TIME' ? 'Đúng giờ' : statusKey === 'LATE' ? 'Đi muộn' : 'Về sớm';
            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => setStatusFilter(statusKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === statusKey
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bento Master Attendance Logs Table (Cấu trúc Hình 2) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px] whitespace-nowrap">
              <tr>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80">Nhân sự</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80">Ca làm</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Thời gian</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Sự kiện</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80">Phương thức</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Độ khớp</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Trễ / Sớm</th>
                <th className="py-3.5 px-4 font-semibold text-white border-r border-slate-800/80 text-center">Tăng ca</th>
                <th className="py-3.5 px-4 font-semibold text-white text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredEmployeePairs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-mono">
                    Không tìm thấy dữ liệu điểm danh phù hợp cho ngày đang chọn.
                  </td>
                </tr>
              ) : (
                filteredEmployeePairs.map((item, empIdx) => {
                  const {
                    employee,
                    shift,
                    events,
                    hasCheckedOut,
                    overtimeStr,
                    currentOTSec,
                    currentLateEarlySec,
                    lateEarlyStr
                  } = item;
                  const inEvent = events[0];
                  const outEvent = events[1];

                  const isLateEarlyActive = currentLateEarlySec > 0;
                  const isOvertimeActive = hasCheckedOut && currentOTSec > 0;

                  return (
                    <React.Fragment key={employee.employee_id}>
                      {/* Row 1: Vào Ca */}
                      <tr className={`hover:bg-slate-800/40 transition-colors ${empIdx !== 0 ? 'border-t-2 border-slate-800' : ''}`}>
                        {/* Nhân sự (rowSpan = 2) */}
                        <td rowSpan={2} className="py-3.5 px-4 border-r border-slate-800/80 align-middle bg-slate-950/40 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={employee.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                              alt={employee.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                            />
                            <div>
                              <p className="font-semibold text-white text-sm">{employee.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{employee.department} • {employee.employee_id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Ca làm (rowSpan = 2) */}
                        <td rowSpan={2} className="py-3.5 px-4 border-r border-slate-800/80 align-middle bg-slate-950/20 font-mono whitespace-nowrap">
                          <p className="font-semibold text-white">{shift.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{shift.timeRange}</p>
                          <p className="text-[10px] text-blue-400/90 font-mono mt-1">{formatShiftDate(shift.date)}</p>
                        </td>

                        {/* Vào Ca - Thời gian */}
                        <td className="py-3 px-4 font-mono border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className="text-white font-medium">{inEvent.time}</span>
                        </td>

                        {/* Vào Ca - Sự kiện */}
                        <td className="py-3 px-4 border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className="font-mono text-[10px] px-2.5 py-1 rounded-lg font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap inline-block">
                            {inEvent.label}
                          </span>
                        </td>

                        {/* Vào Ca - Phương thức & Thiết bị */}
                        <td className="py-3 px-4 border-r border-slate-800/80 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap">
                            {inEvent.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            )}
                            <span>{inEvent.methodLabel}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{inEvent.device_id}</div>
                        </td>

                        {/* Vào Ca - Độ khớp */}
                        <td className="py-3 px-4 font-mono font-bold border-r border-slate-800/80 text-center whitespace-nowrap">
                          {inEvent.score != null ? (
                            <span className="text-green-400">{(inEvent.score * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-slate-500">--</span>
                          )}
                        </td>

                        {/* Vào Ca - Trạng thái */}
                        <td className="py-3 px-4 border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono whitespace-nowrap inline-block ${getStatusBadgeStyle(inEvent.statusText)}`}>
                            {inEvent.statusText}
                          </span>
                        </td>

                        {/* Thời gian đi trễ/về sớm (rowSpan = 2) - Nổi bật đỏ nếu > 0, ảm đạm nếu = 0 */}
                        <td rowSpan={2} className="py-3.5 px-4 border-r border-slate-800/80 align-middle text-center bg-slate-950/30 whitespace-nowrap">
                          <span className={`font-mono text-sm px-3 py-1 rounded-xl border inline-block transition-all ${isLateEarlyActive
                            ? 'text-red-400 bg-red-500/20 border-red-500/40 shadow-sm shadow-red-500/20 font-bold'
                            : 'text-slate-500 bg-slate-800/30 border-slate-700/40 font-normal'
                            }`}>
                            {lateEarlyStr}
                          </span>
                        </td>

                        {/* Tăng ca (rowSpan = 2) - Nổi bật vàng nếu > 0, ảm đạm nếu = 0 */}
                        <td rowSpan={2} className="py-3.5 px-4 border-r border-slate-800/80 align-middle text-center bg-slate-950/30 whitespace-nowrap">
                          <span className={`font-mono text-sm px-3 py-1 rounded-xl border inline-block transition-all ${isOvertimeActive
                            ? 'text-amber-400 bg-amber-500/20 border-amber-500/40 shadow-sm shadow-amber-500/20 font-bold'
                            : 'text-slate-500 bg-slate-800/30 border-slate-700/40 font-normal'
                            }`}>
                            {overtimeStr}
                          </span>
                        </td>

                        {/* Thao tác (rowSpan = 2) */}
                        <td rowSpan={2} className="py-3.5 px-4 align-middle text-center bg-slate-950/40 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => (item.hasCheckedIn || item.hasCheckedOut) && handleOpenEditModal(item)}
                            disabled={!item.hasCheckedIn && !item.hasCheckedOut}
                            title={!item.hasCheckedIn && !item.hasCheckedOut ? 'Không thể chỉnh sửa khi chưa chấm công' : 'Chỉnh sửa đi trễ/về sớm & tăng ca'}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 mx-auto ${item.hasCheckedIn || item.hasCheckedOut
                              ? 'bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 cursor-pointer shadow-sm'
                              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                              }`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Chỉnh sửa</span>
                          </button>
                        </td>
                      </tr>

                      {/* Row 2: Hết ca */}
                      <tr className="hover:bg-slate-800/40 transition-colors">
                        {/* Hết ca - Thời gian */}
                        <td className="py-3 px-4 font-mono border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className="text-white font-medium">{outEvent.time}</span>
                        </td>

                        {/* Hết ca - Sự kiện */}
                        <td className="py-3 px-4 border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className="font-mono text-[10px] px-2.5 py-1 rounded-lg font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap inline-block">
                            {outEvent.label}
                          </span>
                        </td>

                        {/* Hết ca - Phương thức & Thiết bị */}
                        <td className="py-3 px-4 border-r border-slate-800/80 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap">
                            {outEvent.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            )}
                            <span>{outEvent.methodLabel}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{outEvent.device_id}</div>
                        </td>

                        {/* Hết ca - Độ khớp */}
                        <td className="py-3 px-4 font-mono font-bold border-r border-slate-800/80 text-center whitespace-nowrap">
                          {outEvent.score != null ? (
                            <span className="text-green-400">{(outEvent.score * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-slate-500">--</span>
                          )}
                        </td>

                        {/* Hết ca - Trạng thái */}
                        <td className="py-3 px-4 border-r border-slate-800/80 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono whitespace-nowrap inline-block ${getStatusBadgeStyle(outEvent.statusText)}`}>
                            {outEvent.statusText}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chỉnh Sửa Đi Trễ / Về Sớm & Tăng Ca */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Chỉnh Sửa Thời Gian Chấm Công</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Employee Info */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <img
                  src={editingItem.employee.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={editingItem.employee.full_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <p className="font-bold text-white">{editingItem.employee.full_name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {editingItem.employee.department} • {editingItem.employee.employee_id}
                  </p>
                </div>
              </div>

              {/* Shift & Attendance Detail Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Ca làm việc quy định:</span>
                  <span className="font-semibold text-white mt-0.5 block">{editingItem.shiftName} ({editingItem.shiftTimeRange})</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Vào ca - Hết ca thực tế:</span>
                  <span className="font-semibold text-white mt-0.5 block font-mono">
                    {editingItem.inTime} → {editingItem.outTime}
                  </span>
                </div>
              </div>

              {/* Section 1: Điều chỉnh Đi trễ / Về sớm */}
              <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-200">
                    Thời gian Đi trễ / Về sớm điều chỉnh:
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Tối đa thực tế: <span className="text-red-400 font-bold">{formatSecondsToHHMMSS(editingItem.initialLateEarlySec)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Giờ (Hours)</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={inputLEHours}
                      onChange={e => handleLEChange(parseInt(e.target.value) || 0, inputLEMinutes, inputLESeconds)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Phút (Minutes)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={inputLEMinutes}
                      onChange={e => handleLEChange(inputLEHours, parseInt(e.target.value) || 0, inputLESeconds)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Giây (Seconds)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={inputLESeconds}
                      onChange={e => handleLEChange(inputLEHours, inputLEMinutes, parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-1 pt-1 border-t border-slate-800/60">
                  <span>Làm tròn (30p): <span className="text-red-400 font-bold">{formatSecondsToHHMMSS(roundTo30Minutes(inputLEHours * 3600 + inputLEMinutes * 60 + inputLESeconds))}</span></span>
                </div>
              </div>

              {/* Section 2: Điều chỉnh Thời gian Tăng ca */}
              <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-200">
                    Thời gian Tăng ca điều chỉnh:
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Tối đa thực tế: <span className="text-amber-400 font-bold">{formatSecondsToHHMMSS(editingItem.initialOTSec)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Giờ (Hours)</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={inputOTHours}
                      onChange={e => handleOTChange(parseInt(e.target.value) || 0, inputOTMinutes, inputOTSeconds)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Phút (Minutes)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={inputOTMinutes}
                      onChange={e => handleOTChange(inputOTHours, parseInt(e.target.value) || 0, inputOTSeconds)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Giây (Seconds)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={inputOTSeconds}
                      onChange={e => handleOTChange(inputOTHours, inputOTMinutes, parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-1 pt-1 border-t border-slate-800/60">
                  <span>Làm tròn (30p): <span className="text-amber-400 font-bold">{formatSecondsToHHMMSS(roundTo30Minutes(inputOTHours * 3600 + inputOTMinutes * 60 + inputOTSeconds))}</span></span>
                </div>
              </div>

              {/* Validation Warning */}
              {modalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleSaveAttendanceAdjustments}
                disabled={modalError !== null}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${modalError === null
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};