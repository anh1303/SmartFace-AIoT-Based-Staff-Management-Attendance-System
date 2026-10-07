import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ScanFace,
  LayoutDashboard,
  CalendarDays,
  Clock,
  User,
  DollarSign,
  FileText,
  Users,
  UserCheck,
  CalendarRange,
  Eye,
  BarChart3,
  Banknote,
  Fingerprint,
  LogOut,
  ExternalLink
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const staffNavItems = [
    { label: 'Bàn làm việc', path: '/app/staff/dashboard', icon: LayoutDashboard },
    { label: 'Lịch trình làm việc', path: '/app/staff/schedule', icon: CalendarDays },
    { label: 'Chấm công & Check-in', path: '/app/staff/attendance', icon: Clock },
    { label: 'Hồ sơ & Sinh trắc', path: '/app/staff/profile', icon: User },
    { label: 'Lương tạm tính', path: '/app/staff/salary-estimate', icon: DollarSign },
    { label: 'Lịch sử phiếu lương', path: '/app/staff/salary-history', icon: FileText },
  ];

  const managerNavItems = [
    { label: 'Tổng quan hệ thống', path: '/app/manager/dashboard', icon: LayoutDashboard },
    { label: 'Quản lý nhân viên', path: '/app/manager/employees', icon: Users },
    { label: 'Chi tiết nhân viên', path: '/app/manager/employee-detail', icon: UserCheck },
    { label: 'Cập nhật sinh trắc học', path: '/app/manager/biometrics', icon: Fingerprint },
    { label: 'Sắp xếp lịch làm', path: '/app/manager/schedule', icon: CalendarRange },
    { label: 'Theo dõi chấm công', path: '/app/manager/attendance', icon: Eye },
    { label: 'Báo cáo & Thống kê', path: '/app/manager/reports', icon: BarChart3 },
    { label: 'Quản lý lương', path: '/app/manager/payroll', icon: Banknote },
  ];

  const navItems = role === 'manager' ? managerNavItems : staffNavItems;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-[#0f1224] border-r border-slate-200/80 dark:border-[#1d2243] flex flex-col transition-all duration-300 shadow-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-200/80 dark:border-[#1d2243]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/25">
              <ScanFace className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  AIoT Attendance
                </span>
              </div>
            </div>
          </div>

          {/* Role Pill */}
          <div className="mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-[#151936] border border-slate-200/80 dark:border-[#242b5c] flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${role === 'manager' ? 'bg-purple-500 shadow-xs shadow-purple-400/50' : 'bg-emerald-500 shadow-xs shadow-emerald-400/50'}`} />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Vai trò: <strong className="text-slate-900 dark:text-white capitalize">{role === 'manager' ? 'Quản lý' : 'Nhân viên'}</strong>
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            {role === 'manager' ? 'Phân hệ Quản trị' : 'Phân hệ Nhân viên'}
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-600/20 dark:text-purple-300 font-semibold border border-purple-200/80 dark:border-purple-500/30 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-[#181c38] hover:text-slate-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            Cổng thông tin
          </div>

          {/* Public Landing Link */}
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-[#181c38] transition-colors"
          >
            <ExternalLink className="w-4.5 h-4.5 shrink-0" />
            <span>Trang giới thiệu</span>
          </NavLink>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-200/80 dark:border-[#1d2243] bg-slate-50/60 dark:bg-[#0f1224]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-[#181c38] overflow-hidden flex items-center justify-center border border-slate-200 dark:border-[#272d5a] shrink-0">
                <img
                  src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={currentUser?.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                  {currentUser?.full_name || 'Khách'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {currentUser?.email || (role === 'manager' ? 'manager@company.com' : 'staff@company.com')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-[#181c38] rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};