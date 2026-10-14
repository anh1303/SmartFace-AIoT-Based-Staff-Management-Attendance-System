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
  CalendarRange
} from 'lucide-react';
import { Employee } from '../../../types';

interface EmployeeDetailHeaderProps {
  currentEmp: Employee;
  employees: Employee[];
  activeTab: 'overview' | 'attendance' | 'payroll' | 'schedule';
  setActiveTab: (tab: 'overview' | 'attendance' | 'payroll' | 'schedule') => void;
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
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const filteredEmployeeList = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      e =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.includes(q)
    );
  }, [employees, employeeSearchQuery]);

  return (
    <div className="bento-hero-gradient rounded-2xl p-5 transition-all">
      {/* Ambient Floating & Morphing Blurred Blobs */}
      <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

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

        {/* Right: Employee Selector & Quick Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Prev / Next Buttons */}
          <div className="flex items-center bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={onPrevEmployee}
              title="Nhân viên trước"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dropdown Employee Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer"
              >
                <img
                  src={currentEmp.avatar}
                  alt={currentEmp.full_name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="text-left">
                  <p className="font-semibold leading-tight">{currentEmp.full_name}</p>
                  <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 leading-tight">
                    {currentEmp.employee_id}
                  </p>
                </div>
              </button>

              {/* Popup Dropdown Filter Menu */}
              {isEmployeeDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsEmployeeDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2.5 border-b border-slate-100 dark:border-[#21264b]">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm nhân viên..."
                          value={employeeSearchQuery}
                          onChange={e => setEmployeeSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1d2243]">
                      {filteredEmployeeList.map(emp => (
                        <button
                          key={emp.employee_id}
                          type="button"
                          onClick={() => {
                            onSelectEmployee(emp);
                            setIsEmployeeDropdownOpen(false);
                            setEmployeeSearchQuery('');
                          }}
                          className={`w-full p-2.5 flex items-center gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer ${emp.employee_id === currentEmp.employee_id ? 'bg-purple-50/60 dark:bg-purple-950/30' : ''
                            }`}
                        >
                          <img
                            src={emp.avatar}
                            alt={emp.full_name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {emp.full_name}
                            </p>
                            <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                              {emp.employee_id} • {emp.position || emp.department}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onNextEmployee}
              title="Nhân viên kế tiếp"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1a1e3a] rounded-lg transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Edit Profile Button */}
          <button
            type="button"
            onClick={onOpenEditModal}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-purple-600/20 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Sửa</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={onPrint}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
            title="In / Xuất PDF Hồ sơ"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-[#21264b] overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'overview'
            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
            }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Tổng quan & Sinh trắc</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'attendance'
            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
            }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Nhật ký Chấm công</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'schedule'
            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
            }`}
        >
          <CalendarRange className="w-3.5 h-3.5" />
          <span>Lịch làm việc</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${activeTab === 'payroll'
            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
            }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Lương & Phiếu lương</span>
        </button>
      </div>
    </div>
  );
};
