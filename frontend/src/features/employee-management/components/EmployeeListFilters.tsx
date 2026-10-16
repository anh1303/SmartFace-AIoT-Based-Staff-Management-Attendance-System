import React from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface EmployeeListFiltersProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onClearSearch: () => void;
  filteredCount?: number;
  totalCount?: number;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  departmentOptions: string[];
  positionFilter: string;
  onPositionFilterChange: (val: string) => void;
  positionOptions: string[];
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
}

export const EmployeeListFilters: React.FC<EmployeeListFiltersProps> = ({
  searchTerm,
  onSearchChange,
  onClearSearch,
  departmentFilter,
  onDepartmentFilterChange,
  departmentOptions,
  positionFilter,
  onPositionFilterChange,
  positionOptions,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs transition-colors">
      <div className="relative w-full lg:w-96">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tên, mã NV, email, vị trí, SĐT..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        {/* Bộ lọc Phòng ban */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            Phòng ban:
          </span>
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(e) => onDepartmentFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="ALL">Tất cả phòng ban</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Bộ lọc Chức vụ */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            Chức vụ:
          </span>
          <div className="relative">
            <select
              value={positionFilter}
              onChange={(e) => onPositionFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="ALL">Tất cả chức vụ</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Bộ lọc Trạng thái */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            Trạng thái:
          </span>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Tạm ngưng</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
