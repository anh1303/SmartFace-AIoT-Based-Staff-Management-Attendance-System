import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Printer,
  Edit,
  User,
  Clock,
  DollarSign,
  CalendarRange,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { isAnotherManager } from '../../../utils/permissionUtils';

interface EmployeeDetailHeaderProps {
  currentEmp: Employee;
  employees: Employee[];
  activeTab: 'overview' | 'attendance' | 'payroll' | 'schedule' | 'account';
  setActiveTab: (tab: 'overview' | 'attendance' | 'payroll' | 'schedule' | 'account') => void;
  onSelectEmployee: (emp: Employee) => void;
  onPrevEmployee: () => void;
  onNextEmployee: () => void;
  onOpenEditModal: () => void;
  onPrint: () => void;
  attendanceTotalLogs: number;
  shiftsCount: number;
}

export const EmployeeDetailHeader: React.FC<EmployeeDetailHeaderProps> = ({
  currentEmp,
  employees,
  activeTab,
  setActiveTab,
  onSelectEmployee,
  onPrevEmployee,
  onNextEmployee,
  onOpenEditModal,
  onPrint,
  shiftsCount
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const filteredEmployeeList = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      e =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        (e.phone && e.phone.includes(q))
    );
  }, [employees, employeeSearchQuery]);

  return (
    <div
      style={{ overflow: 'visible' }}
      className="bento-hero-gradient rounded-2xl p-5 transition-all relative z-20"
    >
      {/* Ambient Floating & Morphing Blurred Blobs in clipped background container */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl animate-blob-3" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Page Title & Breadcrumb */}
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/manager/employees')}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
              title="Quay lại danh sách nhân viên"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight flex items-center gap-2">
              Hồ Sơ Chi Tiết Nhân Viên
            </h1>
          </div>
        </div>

        {/* Right: Employee Selector & Quick Navigation Controls (3 box cùng nằm trên 1 hàng) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quick Prev / Next Buttons & Dropdown Container (Vùng màu xanh) */}
          <div className="relative w-[180px] sm:w-[240px] shrink-0">
            <div className="flex items-center h-[36px] bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-1 shadow-inner">
              <button
                type="button"
                onClick={onPrevEmployee}
                title="Nhân viên trước"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Middle Button: Employee details */}
              <button
                type="button"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                title={`${currentEmp.full_name} (${currentEmp.employee_id})`}
                className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer min-w-0 flex-1 h-full text-left"
              >
                <img
                  src={currentEmp.avatar}
                  alt={currentEmp.full_name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="text-left min-w-0 flex-1">
                  <p className="font-semibold text-xs leading-none truncate" title={currentEmp.full_name}>
                    {currentEmp.full_name}
                  </p>
                  <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 leading-none truncate mt-0.5" title={currentEmp.employee_id}>
                    {currentEmp.employee_id}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={onNextEmployee}
                title="Nhân viên kế tiếp"
                className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Popup Dropdown Filter Menu (Vùng màu đỏ): Kích thước y hệt, sát bên dưới, tối đa 5 nhân viên */}
            {isEmployeeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsEmployeeDropdownOpen(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 w-full bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-100 dark:border-[#21264b]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Tìm nhân viên..."
                        value={employeeSearchQuery}
                        onChange={e => setEmployeeSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#1d2243]">
                    {filteredEmployeeList.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Không tìm thấy
                      </div>
                    ) : (
                      filteredEmployeeList.map(emp => {
                        const restricted = isAnotherManager(emp, currentUser);

                        return (
                          <button
                            key={emp.employee_id}
                            type="button"
                            disabled={restricted}
                            onClick={() => {
                              if (restricted) return;
                              onSelectEmployee(emp);
                              setIsEmployeeDropdownOpen(false);
                              setEmployeeSearchQuery('');
                            }}
                            title={
                              restricted
                                ? `Quản lý khác (${emp.full_name}) - Không có quyền xem chi tiết`
                                : `${emp.employee_id} - ${emp.full_name}`
                            }
                            className={`w-full h-9 px-2.5 flex items-center gap-2 text-left transition-colors min-w-0 ${restricted
                              ? 'opacity-50 cursor-not-allowed bg-slate-50/50 dark:bg-[#121528]'
                              : 'hover:bg-slate-50 dark:hover:bg-[#1a1e3a] cursor-pointer'
                              } ${emp.employee_id === currentEmp.employee_id ? 'bg-purple-50/60 dark:bg-purple-950/30' : ''
                              }`}
                          >
                            <img
                              src={emp.avatar}
                              alt={emp.full_name}
                              className={`w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 ${restricted ? 'grayscale-50' : ''
                                }`}
                            />
                            <div className="overflow-hidden min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={emp.full_name}>
                                  {emp.full_name}
                                </p>
                                {restricted && (
                                  <span className="shrink-0 flex items-center text-amber-500 text-[10px]">
                                    <Lock className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate" title={emp.employee_id}>
                                {emp.employee_id}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Edit Profile Button */}
          <button
            type="button"
            onClick={onOpenEditModal}
            className="px-3.5 h-[36px] rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-purple-600/20 cursor-pointer shrink-0"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Sửa</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={onPrint}
            className="w-[36px] h-[36px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer shrink-0"
            title="In / Xuất PDF Hồ sơ"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation căn đều 5 button */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-5 pt-4 border-t border-slate-100/10 dark:border-white/10 w-full relative z-10">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Tổng quan & Sinh trắc</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Nhật ký Chấm công</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Lịch làm việc</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'payroll'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Lương & Phiếu lương</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'account'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Tài khoản</span>
        </button>
      </div>
    </div>
  );
};
