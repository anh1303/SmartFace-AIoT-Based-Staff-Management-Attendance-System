import React from 'react';
import { Calendar } from 'lucide-react';
import { getTodayVNString } from '../../../utils/dateUtils';
import { SearchInput, FilterSelect, FilterBar, FilterSelectOption } from '../../../components/common';

interface AttendanceFiltersProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (dept: string) => void;
  departmentOptions: (string | FilterSelectOption)[];
  positionFilter: string;
  setPositionFilter: (pos: string) => void;
  positionOptions: (string | FilterSelectOption)[];
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  searchTerm,
  setSearchTerm,
  departmentFilter,
  setDepartmentFilter,
  departmentOptions,
  positionFilter,
  setPositionFilter,
  positionOptions,
  statusFilter,
  setStatusFilter,
}) => {
  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    setStartDate(newStart);
    if (endDate && newStart > endDate) {
      setEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndDate(newEnd);
    if (startDate && newEnd < startDate) {
      setStartDate(newEnd);
    }
  };

  const handleSelectToday = () => {
    const today = getTodayVNString();
    setStartDate(today);
    setEndDate(today);
  };

  const isTodaySelected = startDate === getTodayVNString() && endDate === getTodayVNString();

  return (
    <div className="space-y-4">
      {/* Thanh 1: Chọn khoảng ngày chấm công */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 flex flex-wrap items-center gap-3 shadow-xs transition-colors">
        {/* Từ ngày */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Từ ngày:</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs hidden sm:inline">-</span>

        {/* Đến ngày */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition-colors">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Đến ngày:</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Nút Hôm nay */}
        <button
          type="button"
          onClick={handleSelectToday}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isTodaySelected
              ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
              : 'bg-slate-100 dark:bg-[#181c38] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#272d5a]'
          }`}
        >
          Hôm nay
        </button>
      </div>

      {/* Thanh 2: Tìm kiếm nhân viên, Phòng ban, Chức vụ, Trạng thái */}
      <FilterBar>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Tìm kiếm nhân viên"
        />

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <FilterSelect
            label="Phòng ban:"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            allLabel="Tất cả phòng ban"
            options={departmentOptions}
          />

          <FilterSelect
            label="Chức vụ:"
            value={positionFilter}
            onChange={setPositionFilter}
            allLabel="Tất cả chức vụ"
            options={positionOptions}
          />

          <FilterSelect
            label="Trạng thái:"
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="Tất cả trạng thái"
            options={[
              { value: 'ON_TIME', label: 'Đúng giờ' },
              { value: 'LATE', label: 'Đi muộn' },
              { value: 'EARLY_LEAVE', label: 'Về sớm' },
            ]}
          />
        </div>
      </FilterBar>
    </div>
  );
};
