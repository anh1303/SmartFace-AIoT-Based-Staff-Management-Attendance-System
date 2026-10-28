import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, ChevronRight } from 'lucide-react';
import { FloatingNotificationBubble } from '../../features/notifications';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { QuickSettingsMenu } from './QuickSettingsMenu';

const labels: Record<string, string> = {
  dashboard: 'Tổng quan',
  employees: 'Nhân viên',
  'employee-detail': 'Chi tiết nhân viên',
  biometrics: 'Sinh trắc học',
  schedule: 'Lịch làm việc',
  attendance: 'Chấm công',
  devices: 'Thiết bị',
  payroll: 'Bảng lương & xét duyệt',
  reports: 'Báo cáo',
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
          <Link
            to={role === 'employee' ? '/app/employee/dashboard' : '/app/manager/dashboard'}
            className="text-slate-500"
          >
            {parts[2] === 'manager' ? 'Quản trị' : 'Cá nhân'}
          </Link>
          <ChevronRight size={14} />
          <span className="font-semibold">{labels[parts[3]] || 'SmartFace'}</span>
          {parts[4] && (
            <>
              <ChevronRight size={14} />
              <span>Chi tiết</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-xs text-slate-500">
          {new Date().toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </span>
        <FloatingNotificationBubble />
        <button
          className="sf-icon-button"
          aria-label={isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <QuickSettingsMenu />
      </div>
    </header>
  );
};
