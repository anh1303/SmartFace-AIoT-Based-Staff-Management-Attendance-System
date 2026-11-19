import React from 'react';
import { useTableSort, compareEmployeeNames } from '../../../hooks/useTableSort';
import { Lock, Pencil } from 'lucide-react';
import { SearchInput, FilterSelect, FilterSelectOption, FilterBar, TableContainer, TableHead, TableHeadRow, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '../../../components/common';
import { Avatar } from '../../../components/common/Avatar';
import type { PayrollRecord } from '../types';
import type { Employee } from '@/features/employees';
import { getTodayVNString } from '../../../utils/dateUtils';

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
  onOpenEarlySettlement?: (record: PayrollRecord) => void;
}

const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;

export const PayrollTable: React.FC<PayrollTableProps> = ({ currentRecords, employees, searchTerm, onSearchChange, departmentFilter, onDepartmentFilterChange, departmentOptions = [], allDepartmentLabel = 'Tất cả phòng ban', positionFilter = 'ALL', onPositionFilterChange = () => {}, positionOptions = [], isFinalized, onOpenEdit, onOpenEarlySettlement }) => {
  const currentMonth = getTodayVNString().slice(0, 7);
  const employeeNames = new Map(employees.map(employee => [employee.employee_id, employee.full_name]));
  const recordName = (record: PayrollRecord) => employeeNames.get(record.employee_id) || record.employee_name || record.employee_id;
  const { sortedRows, sortProps } = useTableSort(currentRecords, {
    name: (a, b) => compareEmployeeNames(recordName(a), recordName(b)),
    rate: (a, b) => (a.hourly_rate || 0) - (b.hourly_rate || 0),
  });
  return <div className="space-y-4">
    <FilterBar><SearchInput value={searchTerm} onChange={onSearchChange} onClear={() => onSearchChange('')} placeholder="Tìm kiếm nhân viên"/><div className="flex flex-wrap gap-3"><FilterSelect label="Phòng ban:" value={departmentFilter} onChange={onDepartmentFilterChange} allLabel={allDepartmentLabel} options={departmentOptions}/><FilterSelect label="Chức vụ:" value={positionFilter} onChange={onPositionFilterChange} allLabel="Tất cả chức vụ" options={positionOptions}/></div></FilterBar>
    <TableContainer minWidth="1200px"><TableHead><TableHeadRow><TableHeadCell width="200px" {...sortProps('name')}>Nhân viên</TableHeadCell><TableHeadCell {...sortProps('rate')}>Lương theo giờ</TableHeadCell><TableHeadCell>Tổng giờ làm</TableHeadCell><TableHeadCell>Tăng ca</TableHeadCell><TableHeadCell>Đi trễ / Về sớm</TableHeadCell><TableHeadCell>Nghỉ làm</TableHeadCell><TableHeadCell>Phụ cấp</TableHeadCell><TableHeadCell>Thực lĩnh</TableHeadCell><TableHeadCell width="180px" isLast>Thao tác</TableHeadCell></TableHeadRow></TableHead>
      <TableBody>{!currentRecords.length && <TableEmpty colSpan={9} message="Không tìm thấy phiếu lương phù hợp với bộ lọc."/>}{sortedRows.map(record => {
        const emp = employees.find(e => e.employee_id === record.employee_id);
        const name = emp?.full_name || record.employee_name || record.employee_id;
        const canEditRecord = Boolean(record.can_edit) && record.status === 'PENDING' && !isFinalized;
        const blocked = !canEditRecord;
        const reason = isFinalized
          ? 'Kỳ lương đã khóa'
          : record.status !== 'PENDING'
            ? 'Chỉ sửa được phiếu chờ duyệt'
            : !record.can_edit
              ? 'Không có quyền chỉnh sửa phiếu lương này'
              : '';
        const hours = record.total_working_hours ?? record.working_hours;
        const range = record.calculation_range;
        return <TableRow key={record.payroll_id}>
          <TableCell align="left"><div className="flex items-center gap-3"><Avatar src={emp?.avatar} name={name} size={40}/><div className="min-w-0"><strong className="break-words">{name}</strong><div className="sf-secondary">{record.employee_id}</div>{range?.is_partial && record.status === 'PENDING' && range.start_date.slice(0, 7) === currentMonth && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" title={`Tính đến ${new Date(range.as_of).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}; chỉ gồm ca đã kết thúc và công đã duyệt.`}>{`Tạm tính: ${range.start_date.slice(5).split('-').reverse().join('/')} – ${range.end_date.slice(5).split('-').reverse().join('/')}`}</p>}</div></div></TableCell>
          <TableCell className="sf-money">{money(record.hourly_rate || 0)}</TableCell>
          <TableCell title="Giờ công đã lưu trên phiếu lương">{hours != null ? `${hours.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} giờ` : '—'}</TableCell>
          <TableCell>{record.total_overtime || 0} giờ</TableCell>
          <TableCell>{record.total_late_early || 0} giờ</TableCell>
          <TableCell>{record.approved_absence_count == null ? 'Chưa có dữ liệu' : `${record.approved_absence_count} ca`}</TableCell>
          <TableCell className="sf-money">{money(record.allowance || 0)}</TableCell>
          <TableCell className="sf-money font-semibold">{money(record.net_salary || 0)}</TableCell>
          <TableCell isLast><div className="flex flex-wrap justify-center gap-2"><button className="sf-button !min-h-8 !px-2 !text-xs" disabled={blocked} title={reason || 'Điều chỉnh phiếu lương và phụ cấp'} onClick={() => onOpenEdit(record)}>{blocked ? <Lock size={13}/> : <Pencil size={13}/>}Sửa</button>{onOpenEarlySettlement && <button className="sf-button !min-h-8 !px-2 !text-xs !border-amber-400 !text-amber-800 dark:!text-amber-300" disabled={blocked} title={reason || 'Quyết toán sớm cho nhân viên nghỉ việc trước hạn'} onClick={() => onOpenEarlySettlement(record)}>Chốt sớm</button>}</div></TableCell>
        </TableRow>;
      })}</TableBody></TableContainer>
  </div>;
};
