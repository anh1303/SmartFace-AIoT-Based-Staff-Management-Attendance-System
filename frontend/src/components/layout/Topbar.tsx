import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  LogOut, 
  User, 
  X,
  ArrowRight,
  Building2,
  Briefcase
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { role, currentUser, logout, employees } = useApp();
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState<string>('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const searchResults = searchQuery.trim()
    ? employees.filter(emp => 
        emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSelectEmployee = (empId: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (role === 'manager') {
      navigate(`/app/manager/employees?search=${encodeURIComponent(empId)}`);
    } else {
      navigate(`/app/staff/profile`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    if (role === 'manager') {
      navigate(`/app/manager/employees?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left section: Hamburger & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live Topbar Search */}
        <div ref={searchRef} className="relative w-full hidden sm:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh nhân sự, phòng ban..."
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Live Search Floating Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800">
              <div className="p-3 bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>KẾT QUẢ TÌM KIẾM ({searchResults.length})</span>
                <span className="text-[10px] text-blue-400">Nhấn Enter để xem tất cả</span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/40">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Không tìm thấy nhân sự phù hợp với "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map(emp => (
                    <div
                      key={emp.employee_id}
                      onClick={() => handleSelectEmployee(emp.employee_id)}
                      className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt={emp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">{emp.full_name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {emp.employee_id}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-500 inline" />
                            <span>{emp.department}</span>
                            <span>•</span>
                            <Briefcase className="w-3 h-3 text-slate-500 inline" />
                            <span>{emp.position}</span>
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                        emp.status === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {emp.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {role === 'manager' && (
                <button
                  type="button"
                  onClick={(e) => handleSearchSubmit(e)}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Xem tất cả danh sách nhân sự</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section: System telemetry, live clock & user identity */}
      <div className="flex items-center gap-3">
        {/* Edge AI Telemetry Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-[11px] font-medium tracking-tight">
            12/12 CAMS ONLINE • 24ms
          </span>
        </div>

        {/* Live Clock */}
        <div className="hidden xl:block font-mono text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          {timeStr}
        </div>

        {/* Authenticated User Status */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">
              {currentUser?.full_name || (role === 'manager' ? 'Nguyễn Minh Anh' : 'Nguyễn Văn A')}
            </p>
            <span className={`text-[10px] font-mono uppercase font-bold ${
              role === 'manager' ? 'text-amber-400' : 'text-blue-400'
            }`}>
              {role === 'manager' ? 'Quản lý' : 'Nhân viên'}
            </span>
          </div>

          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất khỏi hệ thống"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
