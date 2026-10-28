import React from 'react';
import { Lock } from 'lucide-react';
import {
  SearchInput,
  FilterSelect,
  FilterBar,
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  CodeBadge,
  ActionEditButton,
  FilterSelectOption,
} from '../../../components/common';
import { BiometricStatusBadge } from './BiometricStatusBadge';
import { Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { isAnotherManager } from '../../../utils/permissionUtils';

export interface BiometricsEmployeeTableProps {
  employees: Employee[];
  filteredEmployees: Employee[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  departmentOptions: (string | FilterSelectOption)[];
  positionFilter: string;
  onPositionFilterChange: (val: string) => void;
  positionOptions: (string | FilterSelectOption)[];
  onOpenManageModal: (emp: Employee) => void;
}

export type BiometricsStaffTableProps = BiometricsEmployeeTableProps;

export const BiometricsEmployeeTable: React.FC<BiometricsEmployeeTableProps> = ({
  employees,
  filteredEmployees,
  searchTerm,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  departmentOptions,
  positionFilter,
  onPositionFilterChange,
  positionOptions,
  onOpenManageModal,
}) => {
  const { role, currentUser } = useAuth();

  return (
    <div className="space-y-4">
      {/* Thanh tìm kiếm và bộ lọc chuẩn FilterBar như trang Quản lý nhân viên */}
      <FilterBar>
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
          placeholder="Tìm kiếm nhân viên"
        />

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <FilterSelect
            label="Phòng ban:"
            value={departmentFilter}
            onChange={onDepartmentFilterChange}
            allLabel="Tất cả phòng ban"
            options={departmentOptions}
          />

          <FilterSelect
            label="Chức vụ:"
            value={positionFilter}
            onChange={onPositionFilterChange}
            allLabel="Tất cả chức vụ"
            options={positionOptions}
          />
        </div>
      </FilterBar>

      {/* Thanh 2: Bảng Danh Sách Trạng Thái Sinh Trắc Học tách riêng */}
      <TableContainer minWidth="950px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell width="240px" align="center">Nhân viên</TableHeadCell>
            <TableHeadCell width="130px">Mã NV</TableHeadCell>
            <TableHeadCell width="180px">Phòng ban & Chức vụ</TableHeadCell>
            <TableHeadCell width="160px">Khuôn mặt</TableHeadCell>
            <TableHeadCell width="160px">Vân tay</TableHeadCell>
            <TableHeadCell width="100px" isLast>Thao tác</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {filteredEmployees.length === 0 ? (
            <TableEmpty colSpan={6} message="Không tìm thấy nhân sự phù hợp với bộ lọc" />
          ) : (
            filteredEmployees.map((emp) => (
              <TableRow key={emp.employee_id}>
                <TableCell align="left" className="px-5 max-w-[240px]">
                  <div className="flex items-center gap-3.5 min-w-0 text-left" title={emp.full_name}>
                    <img
                      src={
                        emp.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                      }
                      alt={emp.full_name}
                      className="w-9 h-9 rounded-full object-cover border border-blue-200 dark:border-[#272d5a] shrink-0"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white truncate flex-1" title={emp.full_name}>
                      {emp.full_name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <CodeBadge variant="purple" title={emp.employee_id}>
                    {emp.employee_id}
                  </CodeBadge>
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <div className="space-y-0.5 text-center" title={`${emp.department || 'Chung'} • ${emp.position || 'Nhân viên'}`}>
                    <p className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                      {emp.department || 'Chung'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {emp.position || 'Nhân viên'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <BiometricStatusBadge enrolled={emp.face_enrolled} uppercase size="sm" />
                </TableCell>
                <TableCell>
                  <BiometricStatusBadge enrolled={emp.fingerprint_enrolled} uppercase size="sm" />
                </TableCell>
                <TableCell isLast>
                  {(() => {
                    const isSelf = Boolean(
                      currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
                    );
                    const isOtherMgr = isAnotherManager(emp, currentUser);
                    const isBlocked = role !== 'admin' && (isSelf || isOtherMgr);

                    if (isBlocked) {
                      return (
                        <ActionEditButton
                          disabled
                          label="Khóa"
                          icon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                          title={isSelf ? 'Chốt chặn an toàn: Không thể tự sửa dữ liệu nhận diện của chính mình' : 'Chốt chặn an toàn: Không thể sửa dữ liệu nhận diện của Quản lý khác'}
                        />
                      );
                    }

                    return (
                      <ActionEditButton
                        onClick={() => onOpenManageModal(emp)}
                      />
                    );
                  })()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </TableContainer>
    </div>
  );
};

export const BiometricsStaffTable = BiometricsEmployeeTable;
