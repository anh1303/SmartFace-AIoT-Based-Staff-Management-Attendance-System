import React, { useState, useRef, useEffect } from 'react';
import { ScanFace, Fingerprint, ChevronDown, Search } from 'lucide-react';
import { Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { BiometricStatusBadge } from './BiometricStatusBadge';

interface EmployeeBiometricsCardProps {
  employees: Employee[];
  selectedEmpId: string;
  onSelectEmployee: (empId: string) => void;
  currentEmp?: Employee;
}

export const EmployeeBiometricsCard: React.FC<EmployeeBiometricsCardProps> = ({
  employees,
  selectedEmpId,
  onSelectEmployee,
  currentEmp,
}) => {
  const { currentUser, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const isSelfMatch =
      currentUser &&
      (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email) &&
      ('bản thân'.includes(q) || 'bạn'.includes(q) || 'tôi'.includes(q));

    return (
      Boolean(isSelfMatch) ||
      emp.full_name.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      (emp.position && emp.position.toLowerCase().includes(q))
    );
  });

  const selectedLabel = currentEmp
    ? `${currentEmp.employee_id} - ${currentEmp.full_name}`
    : 'Chọn nhân viên...';

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-5 shadow-xs transition-colors">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading uppercase tracking-wider mb-4">
        Chọn Nhân Viên Cần Cập Nhật
      </h2>

      <div className="mb-4 relative" ref={dropdownRef}>
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
          Danh sách nhân viên:
        </label>

        {/* Custom Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={selectedLabel}
          className="w-full max-w-[180px] sm:max-w-[240px] px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer flex items-center justify-between gap-1.5 transition-colors"
        >
          <span className="truncate min-w-0 text-left flex-1" title={selectedLabel}>
            {selectedLabel}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
              }`}
          />
        </button>

        {/* Custom Dropdown Popup: Strictly constrained to max-w-[180px] sm:max-w-[240px] */}
        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-full max-w-[180px] sm:max-w-[240px] bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#272d5a] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {employees.length > 0 && (
              <div className="p-2 border-b border-slate-100 dark:border-[#21264b]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="max-h-[180px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#1d2243]">
              {filteredEmployees.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  {employees.length === 0 ? 'Không có nhân viên trong phòng ban' : 'Không tìm thấy nhân viên'}
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const label = `${emp.employee_id} - ${emp.full_name}`;
                  const isSelected = emp.employee_id === selectedEmpId;
                  const isSelf = Boolean(
                    currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
                  );
                  return (
                    <button
                      key={emp.employee_id}
                      type="button"
                      onClick={() => {
                        onSelectEmployee(emp.employee_id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      title={isSelf && role !== 'admin' ? `${label} (Chỉ xem - Không thể tự sửa)` : label}
                      className={`w-full h-9 px-3 text-left text-xs transition-colors cursor-pointer flex items-center justify-between gap-1.5 min-w-0 ${isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
                        }`}
                    >
                      <span className="truncate min-w-0 flex-1" title={label}>
                        {label}
                      </span>
                      {isSelf && role !== 'admin' && (
                        <span className="text-[10px] text-amber-500 dark:text-amber-400 font-normal shrink-0">
                          (Bạn)
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Employee Card */}
      {currentEmp ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-4 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={
                currentEmp.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
              }
              alt={currentEmp.full_name}
              className="w-14 h-14 rounded-xl object-cover border border-purple-200 dark:border-purple-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3
                className="text-sm font-bold text-slate-900 dark:text-white max-w-[150px] sm:max-w-[180px] truncate"
                title={currentEmp.full_name}
              >
                {currentEmp.full_name}
              </h3>
              <p
                className="text-xs text-purple-600 dark:text-purple-400 font-mono max-w-[150px] sm:max-w-[180px] truncate"
                title={currentEmp.employee_id}
              >
                {currentEmp.employee_id}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[150px] sm:max-w-[180px] truncate"
                title={`${currentEmp.department} • ${currentEmp.position}`}
              >
                {currentEmp.department} • {currentEmp.position}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/60 dark:border-[#21264b] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Face ID:
              </span>
              <BiometricStatusBadge
                enrolled={currentEmp.face_enrolled}
                uppercase
                rounded="md"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Vân tay (FAP30):
              </span>
              <BiometricStatusBadge
                enrolled={currentEmp.fingerprint_enrolled}
                uppercase
                rounded="md"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] text-center text-xs text-slate-400">
          Chưa chọn nhân sự nào
        </div>
      )}
    </div>
  );
};
