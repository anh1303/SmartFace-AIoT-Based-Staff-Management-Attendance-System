import React from 'react';
import { SearchInput, FilterSelect, FilterBar, FilterSelectOption } from '../../../components/common';

interface EmployeeListFiltersProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onClearSearch: () => void;
  filteredCount?: number;
  totalCount?: number;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  departmentOptions: (string | FilterSelectOption)[];
  positionFilter: string;
  onPositionFilterChange: (val: string) => void;
  positionOptions: (string | FilterSelectOption)[];
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  allDepartmentLabel?: string;
  isDepartmentDisabled?: boolean;
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
  allDepartmentLabel = 'Tất cả phòng ban',
  isDepartmentDisabled = false,
}) => {
  return (
    <FilterBar>
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        onClear={onClearSearch}
        placeholder="Tìm kiếm nhân viên"
      />

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <FilterSelect
          label="Phòng ban:"
          value={departmentFilter}
          onChange={onDepartmentFilterChange}
          allLabel={allDepartmentLabel || undefined}
          options={departmentOptions}
          disabled={isDepartmentDisabled}
        />

        <FilterSelect
          label="Chức vụ:"
          value={positionFilter}
          onChange={onPositionFilterChange}
          allLabel="Tất cả chức vụ"
          options={positionOptions}
        />

        <FilterSelect
          label="Trạng thái:"
          value={statusFilter}
          onChange={onStatusFilterChange}
          allLabel="Tất cả trạng thái"
          options={[
            { value: 'ACTIVE', label: 'Đang hoạt động' },
            { value: 'INACTIVE', label: 'Tạm ngưng' },
          ]}
        />
      </div>
    </FilterBar>
  );
};

