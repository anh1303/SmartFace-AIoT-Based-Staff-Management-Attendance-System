import React from 'react';
import { Search, ChevronDown, Edit, Lock } from 'lucide-react';
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
  isFinalized,
  onOpenEdit,
}) => {
  const { role, user: currentUser } = useAuth();
  return (
    <div className="rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#21264b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
            Chi tiết bảng lương từng nhân sự - Kỳ {selectedPeriod}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Hiển thị {currentRecords.length} / {allPeriodRecords.length} nhân sự
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search by Employee */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã NV, chức vụ..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Position / Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              Chức vụ:
            </span>
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(e) => onDepartmentFilterChange(e.target.value)}
                className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-[#13162b]">
                  Tất cả chức vụ
                </option>
                <option value="Bảo vệ" className="bg-white dark:bg-[#13162b]">
                  Bảo vệ
                </option>
                <option value="Nhân viên" className="bg-white dark:bg-[#13162b]">
                  Nhân viên
                </option>
                <option value="Thu ngân" className="bg-white dark:bg-[#13162b]">
                  Thu ngân
                </option>
                {role === 'admin' && (
                  <option value="Quản lý" className="bg-white dark:bg-[#13162b]">
                    Quản lý
                  </option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1010px]">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              <th className="py-3.5 px-4 w-[200px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Nhân sự
              </th>
              <th className="py-3.5 px-3 w-[130px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Lương theo giờ
              </th>
              <th className="py-3.5 px-3 w-[100px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Tổng giờ làm
              </th>
              <th className="py-3.5 px-3 w-[110px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Số giờ tăng ca
              </th>
              <th className="py-3.5 px-3 w-[130px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Số giờ đi trễ/về sớm
              </th>
              <th className="py-3.5 px-3 w-[110px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Phụ cấp
              </th>
              <th className="py-3.5 px-4 w-[130px] font-semibold text-slate-900 dark:text-white border-r border-slate-300 dark:border-[#222956] text-center">
                Thực lĩnh
              </th>
              <th className="py-3.5 px-4 w-[100px] text-center font-bold text-slate-900 dark:text-white">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {currentRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy bảng lương nào phù hợp với bộ lọc.
                </td>
              </tr>
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
                  <tr
                    key={record.payroll_id}
                    className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]"
                  >
                    {/* 1. Nhân sự */}
                    <td className="py-3.5 px-4 border-r border-slate-200 dark:border-[#202752] max-w-[200px]">
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
                          <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate" title={record.employee_id}>
                            {record.employee_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Lương theo giờ */}
                    <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-white font-medium border-r border-slate-200 dark:border-[#202752] text-center truncate" title={`${hourlyRate.toLocaleString('vi-VN')} ₫`}>
                      {hourlyRate.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 3. Tổng giờ làm */}
                    <td className="py-3.5 px-3 font-mono text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-[#202752] text-center truncate" title={`${totalWorkingHours}h`}>
                      {totalWorkingHours}h
                    </td>

                    {/* 4. Số giờ tăng ca */}
                    <td className="py-3.5 px-3 font-mono border-r border-slate-200 dark:border-[#202752] text-center truncate" title={totalOvertime > 0 ? `+${totalOvertime}h` : '0h'}>
                      {totalOvertime > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">
                          +{totalOvertime}h
                        </span>
                      ) : (
                        <span className="text-slate-400">0h</span>
                      )}
                    </td>

                    {/* 5. Số giờ đi trễ/về sớm */}
                    <td className="py-3.5 px-3 font-mono border-r border-slate-200 dark:border-[#202752] text-center truncate" title={totalLateEarly > 0 ? `-${totalLateEarly}h` : '0h'}>
                      {totalLateEarly > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                          -{totalLateEarly}h
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">0h</span>
                      )}
                    </td>

                    {/* 6. Phụ cấp */}
                    <td className="py-3.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-medium border-r border-slate-200 dark:border-[#202752] text-center truncate" title={allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}>
                      {allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </td>

                    {/* 7. Thực lĩnh */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm border-r border-slate-200 dark:border-[#202752] text-center truncate" title={`${netSalary.toLocaleString('vi-VN')} ₫`}>
                      {netSalary.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 8. Thao tác */}
                    <td className="py-3.5 px-4 text-center">
                      {isFinalized ? (
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          Đã khóa
                        </span>
                      ) : isBlockedFromEditing ? (
                        <button
                          type="button"
                          disabled
                          title={isSelf ? 'Chốt chặn an toàn: Không thể tự sửa phiếu lương của chính mình' : 'Chốt chặn an toàn: Không thể sửa phiếu lương của Quản lý khác'}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 dark:bg-[#181c38]/50 dark:text-slate-600 border border-slate-200/50 dark:border-[#272d5a]/40 font-medium text-xs inline-flex items-center gap-1.5 cursor-not-allowed opacity-60"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Khóa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenEdit(record)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] font-medium text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-400" />
                          <span>Sửa</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
