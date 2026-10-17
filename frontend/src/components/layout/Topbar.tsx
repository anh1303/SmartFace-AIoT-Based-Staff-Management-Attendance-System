import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { formatVNTime, formatVNDate } from '../../utils/dateUtils';
import {
  Menu,
  Calendar,
  Sun,
  Moon
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(() => formatVNDate(new Date()));

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(formatVNTime(now));
      setDateStr(formatVNDate(now));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-white/90 dark:bg-[#0f1224]/90 backdrop-blur border-b border-slate-200/80 dark:border-[#1d2243] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none transition-colors duration-200">
      {/* Left section: Hamburger & Live Time + Current Date */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-[#181c38] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#20254b] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/40 px-3 py-1.5 rounded-full flex items-center gap-2.5 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-semibold">{timeStr || 'LIVE'}</span>
          <span className="text-purple-300 dark:text-purple-800">|</span>
          <span className="text-slate-600 dark:text-slate-300 font-sans font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400/80" />
            {dateStr}
          </span>
        </span>
      </div>

      {/* Right section: Theme Switcher, Profile & Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Modern Theme Switch Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Chuyển sang chế độ sáng (Light mode)' : 'Chuyển sang chế độ tối (Dark mode)'}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:border-[#272d5a] dark:text-purple-300 shadow-xs"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span className="text-xs font-medium hidden sm:inline text-slate-200">Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium hidden sm:inline text-slate-700">Tối</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};