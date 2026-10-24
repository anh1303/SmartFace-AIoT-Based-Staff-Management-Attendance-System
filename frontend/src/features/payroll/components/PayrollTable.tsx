import React from 'react';
import { Lock } from 'lucide-react';
import {
  SearchInput,
  FilterSelect,
  FilterSelectOption,
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
} from '../../../components/common';
import { PayrollRecord, Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { isAnotherManager } from '../../../utils/permissionUtils';

interface PayrollTableProps {
  selectedPeriod: string;
  currentRecords: PayrollRecord[];
  allPeriodRecords: PayrollRecord[];
  employees: Employee[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  departmentOptions?: (string | FilterSelectOption)[];
  allDepartmentLabel?: string;
  positionFilter?: string;
  onPositionFilterChange?: (val: string) => void;
  positionOptions?: string[];
  isFinalized: boolean;
  onOpenEdit: (record: PayrollRecord) => void;
}

export const PayrollTable: React.FC<PayrollTableProps> = ({
  selectedPeriod,
  currentRecords,
  allPeriodRecords,
  employees,
  searchTerm,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  departmentOptions = [],
  allDepartmentLabel = 'Tất cả phòng ban',
  positionFilter = 'ALL',
  onPositionFilterChange = () => { },
  positionOptions = [],
  isFinalized,
  onOpenEdit,
}) => {
  const { role, currentUser } = useAuth();

  return (
    <div className="space-y-4">
      {/* Thanh tìm kiếm và bộ lọc chuẩn FilterBar như hình 2 */}
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
            allLabel={allDepartmentLabel}
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

      {/* Thanh 2: Bảng chi tiết lương chuẩn Bento */}
      <TableContainer minWidth="1010px">
        <TableHead>
          <TableHeadRow>
            <TableHeadCell width="200px">Nhân viên</TableHeadCell>
            <TableHeadCell width="130px">Lương theo giờ</TableHeadCell>
            <TableHeadCell width="100px">Tổng giờ làm</TableHeadCell>
            <TableHeadCell width="110px">Số giờ tăng ca</TableHeadCell>
            <TableHeadCell width="130px">Số giờ đi trễ/về sớm</TableHeadCell>
            <TableHeadCell width="110px">Phụ cấp</TableHeadCell>
            <TableHeadCell width="130px">Thực lĩnh</TableHeadCell>
            <TableHeadCell width="100px" isLast>Thao tác</TableHeadCell>
          </TableHeadRow>
        </TableHead>
        <TableBody>
          {currentRecords.length === 0 ? (
            <TableEmpty colSpan={8} message="Không tìm thấy bảng lương nào phù hợp với bộ lọc." />
          ) : (
            currentRecords.map((record) => {
              const emp = employees.find((e) => e.employee_id === record.employee_id);
              const empName = emp?.full_name || record.employee_name || record.employee_id;
              const hourlyRate = record.hourly_rate || 0;
              const netSalary = record.net_salary || 0;
              const totalWorkingHours = record.total_working_hours || 176;
              const totalOvertime = record.total_overtime ?? 0;
              const totalLateEarly = record.total_late_early ?? 0;
              const allowance = record.allowance || 0;

              const isSelf = Boolean(
                emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
              );
              const isOtherMgr = isAnotherManager(emp, currentUser);
              const isBlockedFromEditing = role !== 'admin' && (isSelf || isOtherMgr);

              return (
                <TableRow key={record.payroll_id}>
                  {/* 1. Nhân sự */}
                  <TableCell className="max-w-[200px]" align="left">
                    <div className="flex items-center gap-2.5 min-w-0" title={empName}>
                      <img
                        src={
                          emp?.avatar ||
                          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
                        }
                        alt={empName}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate" title={empName}>
                          {empName}
                        </p>
                        <CodeBadge variant="purple" title={record.employee_id} className="mt-0.5 text-[10px]">
                          {record.employee_id}
                        </CodeBadge>
                      </div>
                    </div>
                  </TableCell>

                  {/* 2. Lương theo giờ */}
                  <TableCell className="font-mono text-slate-900 dark:text-white font-medium truncate" title={`${hourlyRate.toLocaleString('vi-VN')} ₫`}>
                    {hourlyRate.toLocaleString('vi-VN')} ₫
                  </TableCell>

                  {/* 3. Tổng giờ làm */}
                  <TableCell className="font-mono text-slate-700 dark:text-slate-200 truncate" title={`${totalWorkingHours}h`}>
                    {totalWorkingHours}h
                  </TableCell>

                  {/* 4. Số giờ tăng ca */}
                  <TableCell className="font-mono truncate" title={totalOvertime > 0 ? `+${totalOvertime}h` : '0h'}>
                    {totalOvertime > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">
                        +{totalOvertime}h
                      </span>
                    ) : (
                      <span className="text-slate-400">0h</span>
                    )}
                  </TableCell>

                  {/* 5. Số giờ đi trễ/về sớm */}
                  <TableCell className="font-mono truncate" title={totalLateEarly > 0 ? `-${totalLateEarly}h` : '0h'}>
                    {totalLateEarly > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                        -{totalLateEarly}h
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">0h</span>
                    )}
                  </TableCell>

                  {/* 6. Phụ cấp */}
                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 font-medium truncate" title={allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}>
                    {allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                  </TableCell>

                  {/* 7. Thực lĩnh */}
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm truncate" title={`${netSalary.toLocaleString('vi-VN')} ₫`}>
                    {netSalary.toLocaleString('vi-VN')} ₫
                  </TableCell>

                  {/* 8. Thao tác */}
                  <TableCell isLast>
                    {isFinalized ? (
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        Đã khóa
                      </span>
                    ) : isBlockedFromEditing ? (
                      <ActionEditButton
                        disabled
                        label="Khóa"
                        icon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                        title={isSelf ? 'Chốt chặn an toàn: Không thể tự sửa phiếu lương của chính mình' : 'Chốt chặn an toàn: Không thể sửa phiếu lương của Quản lý khác'}
                      />
                    ) : (
                      <ActionEditButton
                        onClick={() => onOpenEdit(record)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </TableContainer>
    </div>
  );
};
