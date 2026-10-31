import React from 'react';
import { Lock, Pencil } from 'lucide-react';
import { SearchInput, FilterSelect, FilterSelectOption, FilterBar, TableContainer, TableHead, TableHeadRow, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '../../../components/common';
import { Avatar } from '../../../components/common/Avatar';
import { PayrollRecord, Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { isAnotherManager, isDifferentDepartment } from '../../../utils/permissionUtils';

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
  attendanceTotals: Map<string, number>;
  attendanceUnavailable: boolean;
  unprocessedEmployeeIds?: Set<string>;
}

const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;

export const PayrollTable: React.FC<PayrollTableProps> = ({ currentRecords, employees, searchTerm, onSearchChange, departmentFilter, onDepartmentFilterChange, departmentOptions = [], allDepartmentLabel = 'Tất cả phòng ban', positionFilter = 'ALL', onPositionFilterChange = () => {}, positionOptions = [], isFinalized, onOpenEdit, onOpenEarlySettlement, attendanceTotals, attendanceUnavailable, unprocessedEmployeeIds = new Set() }) => {
  const { role, currentUser } = useAuth();
  return <div className="space-y-4">
    <FilterBar><SearchInput value={searchTerm} onChange={onSearchChange} onClear={() => onSearchChange('')} placeholder="Tìm kiếm nhân viên"/><div className="flex flex-wrap gap-3"><FilterSelect label="Phòng ban:" value={departmentFilter} onChange={onDepartmentFilterChange} allLabel={allDepartmentLabel} options={departmentOptions}/><FilterSelect label="Chức vụ:" value={positionFilter} onChange={onPositionFilterChange} allLabel="Tất cả chức vụ" options={positionOptions}/></div></FilterBar>
    <TableContainer minWidth="1200px"><TableHead><TableHeadRow><TableHeadCell width="200px">Nhân viên</TableHeadCell><TableHeadCell>Lương theo giờ</TableHeadCell><TableHeadCell>Tổng giờ làm</TableHeadCell><TableHeadCell>Tăng ca</TableHeadCell><TableHeadCell>Đi trễ / Về sớm</TableHeadCell><TableHeadCell>Nghỉ làm</TableHeadCell><TableHeadCell>Phụ cấp</TableHeadCell><TableHeadCell>Thực lĩnh</TableHeadCell><TableHeadCell width="180px" isLast>Thao tác</TableHeadCell></TableHeadRow></TableHead>
      <TableBody>{!currentRecords.length && <TableEmpty colSpan={9} message="Không tìm thấy phiếu lương phù hợp với bộ lọc."/>}{currentRecords.map(record => {
        const emp = employees.find(e => e.employee_id === record.employee_id);
        const name = emp?.full_name || record.employee_name || record.employee_id;
        const self = !!(emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email));
        const other = isAnotherManager(emp, currentUser), different = isDifferentDepartment(emp, currentUser);
        const blocked = isFinalized || record.status !== 'PENDING' || (role !== 'admin' && (self || other || different));
        const reason = isFinalized ? 'Kỳ lương đã khóa' : record.status !== 'PENDING' ? 'Chỉ sửa được phiếu chờ duyệt' : self ? 'Không được tự sửa phiếu lương' : other ? 'Không được sửa phiếu của quản lý khác' : different ? 'Ngoài phòng ban được phụ trách' : '';
        const absences = attendanceTotals.get(record.employee_id);
        const hours = record.total_working_hours ?? record.working_hours;
        return <TableRow key={record.payroll_id}>
          <TableCell align="left"><div className="flex items-center gap-3"><Avatar src={emp?.avatar} name={name} size={40}/><div className="min-w-0"><strong className="break-words">{name}</strong><div className="sf-secondary">{record.employee_id}</div></div></div></TableCell>
          <TableCell className="sf-money">{money(record.hourly_rate || 0)}</TableCell>
          <TableCell title="Giờ công đã lưu trên phiếu lương">{hours != null ? `${hours.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} giờ` : '—'}</TableCell>
          <TableCell>{record.total_overtime || 0} giờ</TableCell>
          <TableCell>{record.total_late_early || 0} giờ</TableCell>
          <TableCell>{attendanceUnavailable ? '—' : unprocessedEmployeeIds.has(record.employee_id) ? 'Chưa tổng hợp' : `${absences ?? 0} ca`}</TableCell>
          <TableCell className="sf-money">{money(record.allowance || 0)}</TableCell>
          <TableCell className="sf-money font-semibold">{money(record.net_salary || 0)}</TableCell>
          <TableCell isLast><div className="flex flex-wrap justify-center gap-2"><button className="sf-button !min-h-8 !px-2 !text-xs" disabled={blocked} title={reason || 'Điều chỉnh phiếu lương và phụ cấp'} onClick={() => onOpenEdit(record)}>{blocked ? <Lock size={13}/> : <Pencil size={13}/>}Sửa</button>{onOpenEarlySettlement && <button className="sf-button !min-h-8 !px-2 !text-xs !border-amber-400 !text-amber-800 dark:!text-amber-300" disabled={blocked} title={reason || 'Quyết toán sớm cho nhân viên nghỉ việc trước hạn'} onClick={() => onOpenEarlySettlement(record)}>Chốt sớm</button>}</div></TableCell>
        </TableRow>;
      })}</TableBody></TableContainer>
  </div>;
};
