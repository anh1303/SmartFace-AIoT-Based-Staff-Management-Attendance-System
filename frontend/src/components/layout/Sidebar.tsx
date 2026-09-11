import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Clock, 
  User, 
  DollarSign, 
  FileText, 
  Users, 
  CalendarRange, 
  Eye, 
  BarChart3, 
  Banknote, 
  Fingerprint, 
  LogOut, 
  ShieldCheck, 
  ExternalLink
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role, currentUser, logout } = useApp();
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
    { label: 'Cập nhật sinh trắc học', path: '/app/manager/biometrics', icon: Fingerprint },
    { label: 'Sắp xếp lịch làm', path: '/app/manager/schedule', icon: CalendarRange },
    { label: 'Theo dõi chấm công', path: '/app/manager/attendance', icon: Eye },
    { label: 'Báo cáo & Thống kê', path: '/app/manager/reports', icon: BarChart3 },
    { label: 'Quản lý lương (Payroll)', path: '/app/manager/payroll', icon: Banknote },
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
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md font-bold text-white text-xs">
              AI
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-white text-base tracking-tight">
                  AIoT Attendance
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Enterprise Biometrics</p>
            </div>
          </div>

          {/* Role Pill */}
          <div className="mt-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${role === 'manager' ? 'bg-orange-400' : 'bg-green-500'}`} />
              <span className="text-xs text-slate-300">
                Vai trò: <strong className="text-white capitalize">{role === 'manager' ? 'Quản lý' : 'Nhân viên'}</strong>
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">PROD</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Cổng thông tin
          </div>

          {/* Public Landing Link */}
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-5 h-5 shrink-0" />
            <span>Trang giới thiệu</span>
          </NavLink>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-700 shrink-0">
                <img
                  src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={currentUser?.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">
                  {currentUser?.full_name || 'Khách'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {currentUser?.email || (role === 'manager' ? 'manager@company.com' : 'staff@company.com')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
