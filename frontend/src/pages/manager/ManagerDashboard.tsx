import React, { useMemo } from 'react';
import { AttendanceEventBadge } from '../../components/common/AttendanceEventBadge';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { formatVNTime, getTodayVNString, formatVNDateISO } from '../../utils/dateUtils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import {
  Users,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  Sun,
  Sunset,
  Briefcase,
  AlertTriangle,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { AttendanceRecord } from '../../types';

export const ManagerDashboard: React.FC = () => {
  const { employees, attendance, workShifts, role, currentUser } = useApp();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const isAdmin = role === 'admin' || currentUser?.role === 'admin' || currentUser?.role_name?.toUpperCase() === 'ADMIN';
  const isManager = !isAdmin && (role === 'manager' || currentUser?.role === 'manager' || currentUser?.role_name?.toUpperCase() === 'MANAGER' || Boolean(currentUser?.is_manager));
  const managerDept = currentUser?.department;

  const todayStr = getTodayVNString();
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayFormattedHeader = useMemo(() => {
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = dayNames[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  }, [now]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;

  const todayShifts = useMemo(() => {
    return workShifts.filter(s => s.date === todayStr && s.shift_type !== 'OFF');
  }, [workShifts, todayStr]);

  const scheduledEmpIds = useMemo(() => {
    return new Set(todayShifts.map(s => s.employee_id));
  }, [todayShifts]);

  const todayWorkingEmployeesCount = scheduledEmpIds.size > 0
    ? scheduledEmpIds.size
    : (activeEmployees > 0 ? activeEmployees : totalEmployees);

  const totalExpectedShiftsToday = todayShifts.length > 0
    ? todayShifts.length
    : todayWorkingEmployeesCount;

  const todayPunches = useMemo(() => {
    return attendance.filter(a => formatVNDateISO(a.timestamp) === todayStr);
  }, [attendance, todayStr]);
  const todayCheckIns = useMemo(() => {
    // One first valid arrival per employee; returning from a break is not a new arrival.
    const first = new Map<string, AttendanceRecord>();
    [...todayPunches].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      .filter(a => a.type === 'CHECK_IN' && (a.raw_status || a.status) === 'VALID')
      .forEach(a => { if (!first.has(a.employee_id)) first.set(a.employee_id, a); });
    return [...first.values()];
  }, [todayPunches]);

  const todayCheckOuts = useMemo(() => {
    return todayPunches.filter(a => a.type === 'CHECK_OUT' || a.type === 'TAN_CA');
  }, [todayPunches]);

  const todayCheckInCount = todayCheckIns.length;
  const todayCheckOutCount = todayCheckOuts.length;

  const checkInRate = totalExpectedShiftsToday > 0
    ? ((todayCheckInCount / totalExpectedShiftsToday) * 100).toFixed(1)
    : '0.0';

  const checkOutRate = totalExpectedShiftsToday > 0
    ? ((todayCheckOutCount / totalExpectedShiftsToday) * 100).toFixed(1)
    : '0.0';

  const currentlyWorkingCount = useMemo(() => {
    const empLatestPunchMap = new Map<string, AttendanceRecord>();
    // Sort ascending to get latest punch per employee
    const sorted = [...todayPunches].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    sorted.forEach(p => {
      empLatestPunchMap.set(p.employee_id, p);
    });

    let count = 0;
    empLatestPunchMap.forEach(lastPunch => {
      if (lastPunch.type === 'CHECK_IN') {
        count += 1;
      }
    });
    return count;
  }, [todayPunches]);

  // Unique employee IDs who checked in today
  const checkedInEmpIds = useMemo(() => {
    return new Set(todayCheckIns.map(a => a.employee_id));
  }, [todayCheckIns]);

  // Punctuality calculation for today
  const getPunctuality = (a: { punctuality?: string; status: string }) =>
    a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status);

  // Lấy trạng thái hiển thị trực tiếp từ dữ liệu DB (status / punctuality / raw_status)
  const getRecordStatus = (record: AttendanceRecord) => {
    if (record.status === 'INVALID' || record.raw_status === 'INVALID') {
      return {
        label: 'Không hợp lệ',
        style: 'bg-[#38101a] text-rose-400 border border-rose-800/80',
      };
    }
    if (record.status === 'FLAGGED' || record.raw_status === 'FLAGGED') {
      return {
        label: 'Cần xác minh',
        style: 'bg-[#2a1d0c] text-amber-400 border border-amber-800/80',
      };
    }

    if (record.punctuality === 'ON_TIME') {
      return {
        label: 'Đúng giờ',
        style: 'bg-[#0c2a20] text-emerald-400 border border-emerald-800/80',
      };
    }
    if (record.punctuality === 'LATE') {
      return {
        label: 'Đi muộn',
        style: 'bg-[#38101a] text-rose-400 border border-rose-800/80',
      };
    }
    if (record.punctuality === 'EARLY_LEAVE') {
      return {
        label: 'Về sớm',
        style: 'bg-[#38101a] text-rose-400 border border-rose-800/80',
      };
    }

    if (record.status === 'VALID' || record.raw_status === 'VALID') {
      return {
        label: 'Đúng giờ',
        style: 'bg-[#0c2a20] text-emerald-400 border border-emerald-800/80',
      };
    }

    return {
      label: record.raw_status || record.status || 'Đúng giờ',
      style: 'bg-[#0c2a20] text-emerald-400 border border-emerald-800/80',
    };
  };

  const onTimeCount = todayCheckIns.filter(a => getPunctuality(a) === 'ON_TIME').length;
  const lateCount = todayCheckIns.filter(
    a => getPunctuality(a) === 'LATE' || getPunctuality(a) === 'EARLY_LEAVE'
  ).length;
  const notCheckedInCount = Math.max(0, todayWorkingEmployeesCount - checkedInEmpIds.size);

  const onTimePct = todayWorkingEmployeesCount > 0
    ? ((onTimeCount / todayWorkingEmployeesCount) * 100).toFixed(1)
    : '0.0';
  const latePct = todayWorkingEmployeesCount > 0
    ? ((lateCount / todayWorkingEmployeesCount) * 100).toFixed(1)
    : '0.0';
  const notCheckedInPct = todayWorkingEmployeesCount > 0
    ? ((notCheckedInCount / todayWorkingEmployeesCount) * 100).toFixed(1)
    : '0.0';

  const donutData = [
    { name: 'Đúng giờ', value: onTimeCount, color: '#10b981', pct: onTimePct },
    { name: 'Đi muộn / về sớm', value: lateCount, color: '#f43f5e', pct: latePct },
    { name: 'Chưa check-in', value: notCheckedInCount, color: '#8b5cf6', pct: notCheckedInPct },
  ];

  const shiftGroups = useMemo(() => {
    interface ShiftGroupItem {
      id: string;
      name: string;
      timeRange: string;
      startTime: string;
      endTime: string;
      count: number;
      type: import('../../types').ShiftType;
    }

    if (todayShifts.length === 0) {
      // Default structure if no shifts scheduled for today
      return [
        { id: 'morning', name: 'Ca sáng', timeRange: '08:00 - 12:00', startTime: '08:00', endTime: '12:00', count: Math.ceil(todayWorkingEmployeesCount * 0.35), type: 'MORNING' as const },
        { id: 'afternoon', name: 'Ca chiều', timeRange: '13:00 - 17:00', startTime: '13:00', endTime: '17:00', count: Math.ceil(todayWorkingEmployeesCount * 0.3), type: 'AFTERNOON' as const },
        { id: 'office', name: 'Ca hành chính', timeRange: '08:00 - 17:30', startTime: '08:00', endTime: '17:30', count: Math.ceil(todayWorkingEmployeesCount * 0.35), type: 'OFFICE_HOURS' as const },
      ];
    }

    const groupMap = new Map<string, ShiftGroupItem>();
    todayShifts.forEach(s => {
      const key = `${s.shift_type}_${s.start_time}_${s.end_time}`;
      if (!groupMap.has(key)) {
        const name = s.shift_type === 'MORNING'
          ? 'Ca sáng'
          : s.shift_type === 'AFTERNOON'
            ? 'Ca chiều'
            : s.shift_type === 'OFFICE_HOURS'
              ? 'Ca hành chính'
              : 'Ca tùy chỉnh';
        groupMap.set(key, {
          id: key,
          name,
          timeRange: `${s.start_time} - ${s.end_time}`,
          startTime: s.start_time,
          endTime: s.end_time,
          count: 0,
          type: s.shift_type,
        });
      }
      groupMap.get(key)!.count += 1;
    });

    return Array.from(groupMap.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [todayShifts, todayWorkingEmployeesCount]);

  const departmentStats = useMemo(() => {
    const colors = ['#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#f59e0b', '#06b6d4', '#6366f1', '#ec4899'];

    const deptMap = new Map<string, { total: number; scheduled: number }>();

    employees.forEach(emp => {
      const dept = emp.department?.trim() || 'Chưa phân phòng';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, scheduled: 0 });
      }
      const stat = deptMap.get(dept)!;
      stat.total += 1;
      if (scheduledEmpIds.has(emp.employee_id)) {
        stat.scheduled += 1;
      }
    });

    return Array.from(deptMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data], idx) => ({
        name,
        scheduled: data.scheduled,
        total: data.total,
        pct: data.total > 0 ? Math.round((data.scheduled / data.total) * 100) : 0,
        color: colors[idx % colors.length],
      }));
  }, [employees, scheduledEmpIds]);

  const dashboardEmployees = useMemo(() => {
    if (isManager && managerDept) {
      const deptEmps = employees.filter(
        e => e.department && e.department.toLowerCase() === managerDept.toLowerCase()
      );
      if (deptEmps.length > 0) return deptEmps;
    }
    return employees;
  }, [employees, isManager, managerDept]);

  const empTodayShiftMap = useMemo(() => {
    const map = new Map<string, { name: string; timeRange: string }>();
    todayShifts.forEach(s => {
      if (!map.has(s.employee_id)) {
        const name = s.shift_type === 'MORNING'
          ? 'Ca sáng'
          : s.shift_type === 'AFTERNOON'
            ? 'Ca chiều'
            : s.shift_type === 'OFFICE_HOURS'
              ? 'Ca HC'
              : 'Ca làm';
        map.set(s.employee_id, {
          name,
          timeRange: `${s.start_time} - ${s.end_time}`,
        });
      }
    });
    return map;
  }, [todayShifts]);

  const sortedDashboardEmployees = useMemo(() => {
    return [...dashboardEmployees].sort((a, b) => {
      const aHasShift = scheduledEmpIds.has(a.employee_id);
      const bHasShift = scheduledEmpIds.has(b.employee_id);
      if (aHasShift && !bHasShift) return -1;
      if (!aHasShift && bHasShift) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
    });
  }, [dashboardEmployees, scheduledEmpIds]);

  const chronologicalTodayPunches = useMemo(() => {
    return [...todayPunches].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [todayPunches]);

  const overdueEmployees = useMemo(() => {
    if (todayShifts.length === 0) {
      // If no shifts mapped, check active employees not checked in if after 08:30
      if (currentHHMM >= '08:30') {
        return employees
          .filter(e => e.status === 'ACTIVE' && !checkedInEmpIds.has(e.employee_id))
          .map(e => e.employee_id);
      }
      return [];
    }

    const lateEmps = todayShifts.filter(s => {
      const isPastStartTime = s.start_time <= currentHHMM;
      const notCheckedIn = !checkedInEmpIds.has(s.employee_id);
      return isPastStartTime && notCheckedIn;
    });

    return Array.from(new Set(lateEmps.map(s => s.employee_id)));
  }, [todayShifts, currentHHMM, checkedInEmpIds, employees]);

  const upcomingShiftNotice = useMemo(() => {
    const uniqueTimes = Array.from(new Set(todayShifts.map(s => s.start_time))).sort();
    for (const st of uniqueTimes) {
      const [h, m] = st.split(':').map(Number);
      const shiftMinutes = h * 60 + m;
      const diff = shiftMinutes - nowMinutes;
      if (diff > 0 && diff <= 60) {
        const sample = todayShifts.find(s => s.start_time === st);
        const shiftName = sample?.shift_type === 'MORNING'
          ? 'Ca sáng'
          : sample?.shift_type === 'AFTERNOON'
            ? 'Ca chiều'
            : 'Ca làm việc';
        return {
          name: shiftName,
          time: st,
          minutesLeft: diff,
        };
      }
    }
    return null;
  }, [todayShifts, nowMinutes]);

  // Helper for shift real-time status badge
  const getShiftLiveStatus = (startTime: string, endTime: string) => {
    if (currentHHMM >= startTime && currentHHMM <= endTime) {
      return { label: 'Đang diễn ra', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
    if (currentHHMM < startTime) {
      return { label: 'Sắp diễn ra', style: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    }
    return { label: 'Đã kết thúc', style: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' };
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="pb-2 border-b border-slate-200/80 dark:border-[#1d2243]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tổng quan hôm nay
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-[#161938] dark:via-[#13162b] dark:to-[#1b1736] border border-slate-200/80 dark:border-[#262c5b] rounded-2xl p-5 flex flex-col justify-between hover:border-purple-400/50 dark:hover:border-purple-500/40 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
              Nhân viên làm việc hôm nay
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {todayWorkingEmployeesCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              / {totalEmployees} nhân viên
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 dark:from-[#11242d] dark:via-[#13162b] dark:to-[#10232b] border border-slate-200/80 dark:border-[#1d4144] rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-400/50 dark:hover:border-emerald-500/40 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <LogIn className="w-4 h-4" />
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
              Đã check-in
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {todayCheckInCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              / {totalExpectedShiftsToday} ca
            </span>
            <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              {checkInRate}%
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30 dark:from-[#12203b] dark:via-[#13162b] dark:to-[#12243d] border border-slate-200/80 dark:border-[#1e345e] rounded-2xl p-5 flex flex-col justify-between hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
              Đang làm việc
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
              {currentlyWorkingCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              người tại văn phòng
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 dark:from-[#2a1d1d] dark:via-[#13162b] dark:to-[#241a18] border border-slate-200/80 dark:border-[#4d2f23] rounded-2xl p-5 flex flex-col justify-between hover:border-amber-400/50 dark:hover:border-amber-500/40 transition-all shadow-xs group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
              Đã check-out
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
              {todayCheckOutCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              / {totalExpectedShiftsToday} ca
            </span>
            <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
              {checkOutRate}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Ca làm việc hôm nay
              </h3>
            </div>

            <div className="space-y-3">
              {shiftGroups.map((shift) => {
                const liveStatus = getShiftLiveStatus(shift.startTime, shift.endTime);
                return (
                  <div
                    key={shift.id}
                    className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#181c38]/60 border border-slate-200/60 dark:border-[#272d5a] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        {shift.type === 'MORNING' ? (
                          <Sun className="w-4 h-4" />
                        ) : shift.type === 'AFTERNOON' ? (
                          <Sunset className="w-4 h-4" />
                        ) : (
                          <Briefcase className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {shift.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {shift.timeRange}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${liveStatus.style}`}>
                        {liveStatus.label}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {shift.count} nhân viên
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Tình hình chấm công hôm nay
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
              <div className="relative w-36 h-36 mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={64}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#0f1224' : '#ffffff',
                        borderColor: isDark ? '#21264b' : '#e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: isDark ? '#ffffff' : '#0f172a',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none text-center">
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white leading-none">
                    {todayWorkingEmployeesCount}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                    Nhân viên
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Đúng giờ
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {onTimeCount} ({onTimePct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Đi muộn / về sớm
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {lateCount} ({latePct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    Chưa check-in
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {notCheckedInCount} ({notCheckedInPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Nhân viên
              </h3>
              {!isAdmin && (
                <span className="ml-auto text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {sortedDashboardEmployees.filter(e => scheduledEmpIds.has(e.employee_id)).length}/{sortedDashboardEmployees.length} có ca
                </span>
              )}
            </div>

            {isAdmin ? (
              <div className="space-y-3 max-h-[195px] overflow-y-auto pr-1">
                {departmentStats.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Chưa có dữ liệu phòng ban hôm nay</p>
                ) : (
                  departmentStats.map((dept, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }}></span>
                          {dept.name}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 font-semibold">
                          {dept.scheduled}/{dept.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#1f244a] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${dept.pct}%`,
                            backgroundColor: dept.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[245px] overflow-y-auto pr-1">
                {sortedDashboardEmployees.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Chưa có dữ liệu nhân viên</p>
                ) : (
                  sortedDashboardEmployees.map((emp) => {
                    const hasShift = scheduledEmpIds.has(emp.employee_id);
                    const shiftInfo = empTodayShiftMap.get(emp.employee_id);
                    const initials = (emp.full_name || emp.employee_id)
                      .split(' ')
                      .map((w: string) => w[0])
                      .slice(-2)
                      .join('');

                    return (
                      <div
                        key={emp.employee_id}
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                          hasShift
                            ? 'bg-slate-50/80 dark:bg-[#181c38]/60 border border-slate-200/50 dark:border-[#22274d]'
                            : 'bg-transparent border border-transparent opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full ${
                              hasShift
                                ? 'bg-blue-100 dark:bg-[#1f254b] text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-[#161a33] text-slate-400 dark:text-slate-500'
                            } font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden`}
                          >
                            {emp.avatar ? (
                              <img
                                src={emp.avatar}
                                alt={emp.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-xs truncate ${
                                hasShift
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'font-normal text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {emp.full_name}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                              {emp.employee_id}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 ml-2">
                          {hasShift ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {shiftInfo?.name || 'Có ca'}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1a1f3d] text-slate-400 dark:text-slate-500">
                              Nghỉ ca
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Nhật ký chấm công hôm nay
            </h3>
          </div>

          <div className="max-h-[310px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-100 dark:border-[#1d2243]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Nhân viên</th>
                  <th className="py-2.5 px-3 text-center">Sự kiện</th>
                  <th className="py-2.5 px-3 text-center">Thời điểm</th>
                  <th className="py-2.5 px-3 text-center">Thiết bị</th>
                  <th className="py-2.5 px-3 text-center">Độ tin cậy</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243]">
                {chronologicalTodayPunches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa có lượt quẹt thẻ nào hôm nay.
                    </td>
                  </tr>
                ) : (
                  chronologicalTodayPunches.map(att => {
                    const emp = employees.find(e => e.employee_id === att.employee_id);
                    const empName = emp?.full_name || att.employee_name || att.employee_id;
                    const initials = empName.split(' ').map((w: string) => w[0]).slice(-2).join('');
                    const statusInfo = getRecordStatus(att);

                    return (
                      <tr
                        key={att.attendance_id}
                        className="hover:bg-slate-50/50 dark:hover:bg-[#171b36]/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-[#1f254b] text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {emp?.avatar ? (
                                <img src={emp.avatar} alt={empName} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {empName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {att.employee_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <AttendanceEventBadge type={att.type} />
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300 font-medium">
                          {formatVNTime(att.timestamp)}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {att.device_id || 'Gate-01'}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium">
                            {att.verification_score !== null && att.verification_score !== undefined
                              ? `${(att.verification_score * 100).toFixed(1)}%`
                              : '--'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${statusInfo.style}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Chú ý
              </h3>
            </div>

            <div className="space-y-3">
              {overdueEmployees.length > 0 && (
                <div
                  onClick={() => navigate('/app/manager/attendance')}
                  className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {overdueEmployees.length} nhân viên chưa check-in
                      </p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-mono truncate">
                        {overdueEmployees.slice(0, 4).join(', ') + (overdueEmployees.length > 4 ? '...' : '')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0 self-center" />
                  </div>
                </div>
              )}

              {upcomingShiftNotice && (
                <div
                  onClick={() => navigate('/app/manager/schedule')}
                  className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        {upcomingShiftNotice.name} sắp bắt đầu
                      </p>
                      <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                        Bắt đầu lúc {upcomingShiftNotice.time} (còn {upcomingShiftNotice.minutesLeft} phút)
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0 self-center" />
                  </div>
                </div>
              )}

              {/* Trạng thái bình thường khi không có bất kỳ cảnh báo nào */}
              {overdueEmployees.length === 0 && !upcomingShiftNotice && (
                <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-[#181c38]/40 border border-slate-200/60 dark:border-[#272d5a] text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 text-center py-6">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Không có cảnh báo nào cần xử lý lúc này</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ManagerDashboard;
