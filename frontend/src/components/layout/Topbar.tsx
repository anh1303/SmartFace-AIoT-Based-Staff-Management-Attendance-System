import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatVNTime } from '../../utils/dateUtils';
import {
  Menu,
  LogOut,
  User
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { role, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(formatVNTime(new Date()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left section: Hamburger */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {timeStr || 'LIVE'}
        </span>
      </div>

      {/* Right section: Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.full_name}
              className="w-9 h-9 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
              {currentUser?.full_name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-white leading-none">
              {currentUser?.full_name || 'Người dùng'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 capitalize leading-none">
              {role === 'manager' ? 'Quản Lý (Manager)' : 'Nhân Viên (Employee)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Đăng xuất khỏi hệ thống"
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};