import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, ChevronRight, Clock } from 'lucide-react';
import { FloatingNotificationBubble } from '../../features/notifications';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const labels: Record<string, string> = {
  dashboard: 'Tổng quan',
  employees: 'Nhân viên',
  'employee-detail': 'Chi tiết nhân viên',
  biometrics: 'Sinh trắc học',
  schedule: 'Lịch làm việc',
  attendance: 'Theo dõi chấm công',
  devices: 'Thiết bị',
  payroll: 'Bảng lương',
  reports: 'Báo cáo & thống kê',
  profile: 'Hồ sơ',
  'salary-estimate': 'Lương tạm tính',
  'salary-history': 'Lịch sử phiếu lương',
};

export const Topbar: React.FC<{
  onToggleSidebar: () => void;
}> = ({ onToggleSidebar }) => {
  const { isDark, toggleTheme } = useTheme();
  const { role } = useAuth();
  const { pathname } = useLocation();
  const parts = pathname.split('/');
  const page = parts[3];
  const employeeLabels: Record<string, string> = { dashboard: 'Bàn làm việc', attendance: 'Lịch sử chấm công', profile: 'Hồ sơ & sinh trắc' };
  const managerGroups: Record<string, string> = { dashboard: 'Dashboard', employees: 'Nhân sự', 'employee-detail': 'Nhân viên', biometrics: 'Nhân sự', schedule: 'Nhân sự', attendance: 'Vận hành', devices: 'Vận hành', payroll: 'Tài chính', reports: 'Tài chính', profile: 'Cá nhân' };
  const employeeGroups: Record<string, string> = { dashboard: 'Công việc', schedule: 'Công việc', attendance: 'Công việc', profile: 'Cá nhân', 'salary-estimate': 'Cá nhân', 'salary-history': 'Cá nhân' };
  const isAccount = parts[2] === 'account';
  const group = isAccount ? 'Cá nhân' : (role === 'employee' ? employeeGroups[page] : managerGroups[page]) || 'SmartFace';
  const pageLabel = isAccount ? 'Hồ sơ' : (role === 'employee' ? employeeLabels[page] : undefined) || labels[page] || 'SmartFace';

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateStr = currentTime.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <header className="sf-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <button
          aria-label="Mở điều hướng"
          className="sf-icon-button lg:hidden"
          onClick={onToggleSidebar}
        >
          <Menu size={21} />
        </button>
        <nav aria-label="Đường dẫn" className="flex gap-2 items-center text-sm truncate">
          <span className="text-slate-500">{group}</span>
          <ChevronRight size={14} />
          <span className="font-semibold">{pageLabel}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#151936] border border-slate-200 dark:border-cyan-500/30 shadow-xs dark:shadow-[0_0_12px_rgba(6,182,212,0.12)]">
          <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 animate-pulse" />
          <span className="font-mono font-extrabold text-sm text-cyan-600 dark:text-cyan-300 tracking-wider">
            {timeStr}
          </span>
          <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
          <span className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-tight">
            {dateStr}
          </span>
        </div>
        <FloatingNotificationBubble />
        <button
          className="sf-icon-button"
          aria-label={isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};
