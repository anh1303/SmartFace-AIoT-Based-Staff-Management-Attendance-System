import React from 'react';
import { FilterBar, SearchInput, FilterSelect, FilterSelectOption } from '../../../components/common';

export interface ScheduleWeekNavigatorProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange?: (dept: string) => void;
  setDepartmentFilter?: (dept: string) => void;
  departmentOptions?: (string | FilterSelectOption)[];
  positionFilter?: string;
  onPositionFilterChange?: (pos: string) => void;
  setPositionFilter?: (pos: string) => void;
  positionOptions?: (string | FilterSelectOption)[];
  // Props cũ giữ lại dạng optional để tương thích
  currentMonday?: Date;
  weekNumber?: number;
  startLabel?: string;
  endLabel?: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onGoCurrentWeek?: () => void;
  onDateSelect?: (dateString: string) => void;
}

export const ScheduleWeekNavigator: React.FC<ScheduleWeekNavigatorProps> = ({
  searchTerm,
  setSearchTerm,
  departmentFilter,
  onDepartmentFilterChange,
  setDepartmentFilter,
  departmentOptions = [],
  positionFilter = 'ALL',
  onPositionFilterChange,
  setPositionFilter,
  positionOptions = [],
}) => {
  const handleDeptChange = onDepartmentFilterChange || setDepartmentFilter || (() => {});
  const handlePosChange = onPositionFilterChange || setPositionFilter || (() => {});

  return (
    <FilterBar>
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        onClear={() => setSearchTerm('')}
        placeholder="Tìm kiếm nhân viên"
      />

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <FilterSelect
          label="Phòng ban:"
          value={departmentFilter}
          onChange={handleDeptChange}
          allLabel="Tất cả phòng ban"
          options={departmentOptions}
        />

        <FilterSelect
          label="Chức vụ:"
          value={positionFilter}
          onChange={handlePosChange}
          allLabel="Tất cả chức vụ"
          options={positionOptions}
        />
      </div>
    </FilterBar>
  );
};

export const ScheduleFilters = ScheduleWeekNavigator;

